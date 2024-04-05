import { MessageChannelMain } from 'electron';
import { ServiceProvider } from '../ipc-services/service-provider';
import { IIpcInbox, IpcRequest } from './interfaces';
import { IpcHelper } from './ipc-core';
import * as IpcP from './ipc-protocol';
import { RemoteInstanceEntry } from './remote-instance-entry';
import { MessagePortMainInbox } from './communicators/message-port-main-inbox';
import { ServiceLocator } from '../ipc-services/service-locator';
import { MessageChannelConstructor } from './message-channel-constructor';


export let ignoreIpcServiceProviderRequest__ = false;

export class RemoteInstanceManager {
	private localInstances: RemoteInstanceEntry[] = [];

	constructor(inbox: IIpcInbox, private channelCreator: MessageChannelConstructor) {
        const requestHandlers: { [key: string]: (requet: IpcRequest) => void; } = {
            [IpcP.MESSAGE_REGISTERINSTANCE]: (request: IpcRequest) => {
                const data = request.body as IpcP.RegisterInstanceRequest;

				const instance = ServiceLocator.get<Record<string, unknown>>(data.contracts);
				
                IpcHelper.response(request, { instanceId: 1 });
            },

            [IpcP.MESSAGE_GETINSTANCE]: (request: IpcRequest) => {
                const data = request.body as IpcP.GetInstanceRequest;

				const chan = this.channelCreator();

				const instance = ServiceLocator.get<Record<string, unknown>>(data.contracts);
				const existingInstance = this.localInstances.find(inst => inst.id.includes(data.contracts[0]));
				if (existingInstance) {
					existingInstance.addInbox(chan.inbox);
					IpcHelper.response(request, { port: chan.port });
				}
				else {
					const instanceId = this.addInstance(instance);
					const h = this.localInstances.find(inst => inst.id.includes(data.contracts[0]));
					h?.addInbox(chan.inbox);
					IpcHelper.response(request, { port: chan.port });
				}
            },
        };

		inbox.onRequest.subscribe((request: IpcRequest) => {
			const messageType = IpcHelper.headerValue<string>(request, IpcP.HEADER_MESSAGE_TYPE);
			try {
				if (messageType && messageType in requestHandlers) {
					requestHandlers[messageType](request);
				}
			}
			catch (error) {
				IpcHelper.responseFailure(request, error);
			}
		});

		/*
		const requestHandlers: { [key: string]: (request: IpcRequest) => void; } = {
			[IpcP.MESSAGE_GETINSTANCE]: (request: IpcRequest) => {
				const data = request.body as IpcP.GetInstanceRequest;

				// Because there is registered AdditionalServiceProvider, need to prevent accessing to IpcHostServiceProvider during this call.
				ignoreIpcServiceProviderRequest__ = true;
				try {
					const instance = ServiceProvider.instance.create<Record<string, unknown>>(data.contracts);
					const existingInstance = this.localInstances.find(inst => inst.id.includes(data.contracts[0]));
					if (existingInstance) {
						IpcHelper.response(request, { instanceId: existingInstance.id });
					}
					else {
						const instanceId = this.addInstance(instance);
						IpcHelper.response(request, { instanceId });
					}
				}
				finally {
					ignoreIpcServiceProviderRequest__ = false;
				}
			},

			[IpcP.MESSAGE_INVOKE]: (request: IpcRequest): void => {
				const invoke = request.body as IpcP.InvokeRequest;
				let entry;
				try {
					entry = this.getRequestedInstanceEntry(invoke);
				}
				catch (error: unknown) {
					const message = getMessageOfError(error);
					loggerService().error(`[RemoteInstanceManager()] Error while invoke (${ invoke.method }):${ message }`, error);
				}
				if (!entry) {
					return;
				}
				const instance = entry.instance;

				const args = IpcP.makeInboundArgs(invoke.args, (instanceId: string): unknown => {
					const target: WebContents | undefined = (request.context as { sender?: WebContents; } | undefined)?.sender;
					return IpcProxy.createForInstance<unknown>(instanceId, target, invoke.args);
				});

				let method = instance[invoke.method];

				// instance can be a function itself if it is a callback
				if (!method && typeof instance === 'function') {
					method = instance;
				}

				if (typeof method === 'undefined') {
					IpcHelper.responseFailure(request, `Instance (${ invoke.instanceId }) does not provide invocable property: (${ invoke.method })`);
					return;
				}

				const result = (method as (...values: unknown[]) => unknown).apply(instance, args);
				if (result instanceof Promise) {
					result
						.then(value => {
							const isFunc = typeof value === 'function';
							const isObj = !value || typeof value !== 'object';
							// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
							const existingInstance = !!value && this.localInstances.find(inst => inst.instance.windowPersistentId === value.windowPersistentId);
							if (isFunc || isObj || !isServiceInstance(value) || !existingInstance) {
								IpcHelper.response(request, IpcP.makeOutboundValue(value));
							}
							else {
								IpcHelper.response(request, { dispatchedRemoteInstanceId: existingInstance.id });
							}
						})
						.catch(error => {
							IpcHelper.responseFailure(request, error);
						});
				}
				else {
					IpcHelper.response(request, IpcP.makeOutboundValue(result));
				}
			},

			[IpcP.MESSAGE_EVENT_SUBSCRIBE]: (request: IpcRequest) => {
				const invoke = request.body as IpcP.InvokeRequest;
				let entry;
				try {
					entry = this.getRequestedInstanceEntry(invoke);
				}
				catch (error: unknown) {
					const message = getMessageOfError(error);
					loggerService().error(`[RemoteInstanceManager()] Error while subscribe (${ invoke.method }):${ message }`, error);
				}
				if (!entry) {
					return;
				}
				entry.eventSubscribe(request);
			},

			[IpcP.MESSAGE_EVENT_UNSUBSCRIBE]: (request: IpcRequest) => {
				const invoke = request.body as IpcP.InvokeRequest;
				try {
					const entry = this.getRequestedInstanceEntry(invoke);
					entry.eventUnsubscribe(invoke);
				}
				catch (error: unknown) {
					const message = getMessageOfError(error);
					loggerService().error(`[RemoteInstanceManager()] Error while unusbscribe (${ invoke.method }):${ message }`, error);
				}
			},

			[IpcP.MESSAGE_EVENT_NEXT]: (request: IpcRequest) => {
				const invoke = request.body as IpcP.InvokeRequest;
				let entry;
				try {
					entry = this.getRequestedInstanceEntry(invoke);
				}
				catch (error: unknown) {
					const message = getMessageOfError(error);
					loggerService().error(`[RemoteInstanceManager()] Error while event next (${ invoke.method }):${ message }`, error);
				}
				if (!entry) {
					return;
				}

				const instance = entry.instance[invoke.method] as Nextable;

				if (!instance || !instance.next) {
					IpcHelper.responseFailure(request, `Instance (${ invoke.instanceId }) does not provide nextable subject: (${ invoke.method })`);
					return;
				}

				instance.next(invoke.args[0]);
				IpcHelper.response(request, undefined);
			},

			[IpcP.MESSAGE_REFLECT]: (request: IpcRequest) => {
				const reflectRequest = request.body as IpcP.ReflectInstaceRequest;
				let entry;
				try {
					entry = this.getRequestedInstanceEntry(reflectRequest.instanceId);
				}
				catch (error: unknown) {
					const message = getMessageOfError(error);
					loggerService().error(`[RemoteInstanceManager()] Error while message reflect (${ reflectRequest.instanceId }):${ message }`, error);
				}
				if (!entry) {
					return;
				}
				const aspects = reflectRequest.aspects ?? [];

				const description = reflectLocalInstance(entry.instance, ...aspects);
				IpcHelper.response(request, description);
			},

			[IpcP.MESSAGE_DISPOSE]: (request: IpcRequest) => {
				const instanceId = (request.body as IpcP.DisposeRequest).instanceId;
				this.closeInstance(instanceId);
			},
		};

		inbox.onRequest.subscribe((request: IpcRequest) => {
			const messageType = IpcHelper.headerValue<string>(request, IpcP.HEADER_MESSAGE_TYPE);
			try {
				if (messageType && messageType in requestHandlers) {
					requestHandlers[messageType](request);
				}
			}
			catch (error) {
				IpcHelper.responseFailure(request, error);
			}
		});
		*/
	}



	addInstance(instance: Record<string, unknown>): string {
		const entry = new RemoteInstanceEntry(instance);
		this.localInstances.push(entry);
		return entry.id;
	}

	/*
	closeInstance(id: string): void {
		const index = this.localInstances.findIndex(e => e.id === id);
		if (index < 0) {
			return;
		}

		const entry = this.localInstances.splice(index, 1)[0];
		entry.dispose();
	}*/
/*
	async reflectRemoteInstance(communicator: IpcCommunicator, instanceId: string, aspects: ReflectionAspect[]): Promise<ServiceDescription> {
		const body: IpcP.ReflectInstaceRequest = { instanceId, aspects };
		const response = await communicator.send({
			headers: {
				[IpcP.HEADER_MESSAGE_TYPE]: IpcP.MESSAGE_REFLECT,
			},
			body,
		});

		return IpcHelper.getResponseBody<ServiceDescription>(response);
	}
*/
/*
	private getRequestedInstanceEntry(invoke: IpcP.InvokeRequest | string): InstanceEntry {
		const instanceId = typeof invoke === 'string' ? invoke : invoke.instanceId;

		const entry = this.localInstances.find((e: InstanceEntry) => e.id === instanceId);
		if (!entry) {
			const errorMessage = ((): string => {
				if (typeof invoke === 'string') {
					return `Instance (${ instanceId }) not found`;
				}
				else {
					const maxArgumentsLength = 10;
					let argsString = JSON.stringify(invoke.args);
					if (argsString.length > maxArgumentsLength) {
						argsString = `${ argsString.substr(0, maxArgumentsLength) }...`;
					}
					return `(${ invoke.instanceId }).(${ invoke.method })(${ argsString }): instance not found`;
				}
			})();

			throw new Error(errorMessage);
		}

		return entry;
	}
    */
}
