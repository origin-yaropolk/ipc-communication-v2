/*
import * as Rx from 'rxjs';
import { MessagePortCommunicator } from '../communicators/message-port-communicator';
import * as IpcP from '../ipc-protocol';
import { IpcHelper } from '../ipc-core';
import { Disposable } from '../communicators/communicator-base';
import { IpcMessage } from '../interfaces';

const ignoredMethods = ['then', 'reject'];
const proxyMethods = ['dispose', 'ipcProxyInstanceId', 'ipcProxyCommunicator'];

function ignoreProxyMethod(name: string): boolean {
	return ignoredMethods.includes(name);
}

function isProxyMethod(name: string): boolean {
	return proxyMethods.includes(name);
}

interface IpcProxyState {
	communicator: MessagePortCommunicator;
	instanceId(): Promise<string>;
}

interface ProxyFieldContext {
	proxy: IpcProxyState;
	fieldData: Record<string, unknown>; // this property dedicated to store data per field. Each property keep its data into this field context.field
	propKey: string;
}

class ProxyEventSubscription {
	readonly source = new Rx.Subject<unknown>();
	readonly observable = this.source.asObservable();
}

async function remoteInvoke__<T = unknown>(communicator: MessagePortCommunicator, instanceId: string, method: string, messageType: string, args: any[]): Promise<T> {
	const body: IpcP.InvokeRequest = {
		instanceId,
		method,
		args: IpcP.makeOutboundArgs(args),
	};

	const response = await communicator.send({
		headers: {
			[IpcP.HEADER_MESSAGE_TYPE]: messageType,
		},
		body,
	});

	return IpcHelper.getResponseBody<T>(response);
}

export function remoteInvoke<T = unknown>(communicator: MessagePortCommunicator, instanceId: string, method: string, args: any[]): Promise<T> {
	return remoteInvoke__<T>(communicator, instanceId, method, IpcP.MESSAGE_INVOKE, args);
}

/**
 * IpcProxy is a wrapper for remote instance service.
 * IpcProxy instance will implement ProxyHandler<>.get() that returns field value represented as IpcPropertyProxy.
 * For example:
 *
 * const instance = ... // IpcProxy;
 *
 * instance.callFunction(arg); // -> IpcProxy.get() returns IpcPropertyProxy and then call IpcPropertyProxy.apply(...) method for it;
 *
 * instance.myEvent.subscribe(...); // -> IpcProxy.get() returns IpcPropertyProxy and then call IpcPropertyProxy.get(...) method for it
 *  with in turns return proxy-call-wrapper for subscribe method.
 *
 */
/*
class IpcPropertyProxy implements ProxyHandler<ProxyFieldContext> {
	private static makeSubscribe(context: ProxyFieldContext): (...args: unknown[]) => Rx.Unsubscribable {
		if (!(context.propKey in context.fieldData)) {
			Object.defineProperty(context.fieldData, context.propKey, {
				writable: false,
				configurable: true,
				value: new ProxyEventSubscription(),
			});
		}

		return (...args: unknown[]): Rx.Unsubscribable => {
			type GenericSubscribeable = { subscribe(...a: unknown[]): Rx.Unsubscribable; };
			const eventSubscription: ProxyEventSubscription = Reflect.get(context.fieldData, context.propKey) as ProxyEventSubscription;
			const subscription: Rx.Unsubscribable = (<GenericSubscribeable>eventSubscription.observable).subscribe(...args);

			const methodName = `${ context.propKey }_emit`;

			const proxyInstanceId = serviceHost().registerRemoteInstance({
				[methodName]: (value: unknown) => {
					const eventSource = (Reflect.get(context.fieldData, context.propKey) as ProxyEventSubscription).source;
					eventSource.next(value);
				},
			});

			let remoteSubscriptionId = '';

			(async(): Promise<void> => {
				const instanceId: string = await context.proxy.instanceId();
				remoteSubscriptionId = await remoteInvoke__(context.proxy.communicator, instanceId, context.propKey, IpcP.MESSAGE_EVENT_SUBSCRIBE, [proxyInstanceId]);
			})()
				.catch(error => {
					loggerService().error(`[IpcPropertyProxy.makeSubscribe()] error while attempt to subscribe ipc event (${ context.propKey })`, error);
				});

			return {
				unsubscribe: () => {
					subscription.unsubscribe();
					ServiceHost.instance.unregisterRemoteInstance(proxyInstanceId);

					if (remoteSubscriptionId === '') {
						return;
					}

					ignorePromise(context.proxy.instanceId()
						.then(remoteInstanceId => {
							return remoteInvoke__(context.proxy.communicator, remoteInstanceId, context.propKey, IpcP.MESSAGE_EVENT_UNSUBSCRIBE, [remoteSubscriptionId]);
						}));
				},
			};
		};
	}

	async apply(target: ProxyFieldContext, this_: any, args: any[]): Promise<any> {
		const instanceId: string = await target.proxy.instanceId();
		const result = await remoteInvoke(target.proxy.communicator, instanceId, target.propKey, args);

		if (IpcP.isDispatchedInstance(result)) {
			return IpcProxy.createForInstance<unknown>(result.dispatchedRemoteInstanceId);
		}

		if (IpcP.isDispatchedCallback(result)) {
			return (...cbArgs: any[]) => {
				ignorePromise(remoteInvoke(target.proxy.communicator, result.callbackId, '', cbArgs));
			};
		}

		return result;
	}

	get(context: ProxyFieldContext, propKey: string): any {
		if (propKey === 'subscribe') {
			return IpcPropertyProxy.makeSubscribe(context);
		}
		if (propKey === 'next') {
			return (value: unknown) => {
				ignorePromise(context.proxy.instanceId()
					.then(remoteInstanceId => {
						ignorePromise(remoteInvoke__(context.proxy.communicator, remoteInstanceId, context.propKey, IpcP.MESSAGE_EVENT_NEXT, [value]));
					}));
			};
		}

		throw new Error(`Unknown ipc-proxy property: (${ propKey })`);
	}
}

const ipcPropertyProxyHandler__ = new IpcPropertyProxy();

export interface IIpcProxy {
	ipcProxyInstanceId(): Promise<string>;
	ipcProxyCommunicator(): MessagePortCommunicator;
}

export class IpcProxy implements ProxyHandler<Record<string, unknown>>, IpcProxyState, IIpcProxy, Disposable {
	private readonly instanceIdRequest: Promise<string>;
	private instanceIdValue: string | null = null;
	private readonly properties: Record<string, unknown> = {};

	readonly communicator: MessagePortCommunicator;

    /*
	static createForContracts<T>(contracts: string[], comm): T {
		const proxyHandler = new IpcProxy(this.getCommunicator(contracts[0], target), contracts);
		const proxy: unknown = new Proxy({}, proxyHandler);

		return proxy as T;
	}

	// TODO refactor this method
	static createForInstance<T>(instanceId: string, targetId: number, args?: unknown[]): T {
		const communicator = this.getCommunicator(instanceId, target);
		const proxyHandler = new IpcProxy(communicator, instanceId);
		const proxyTarget = this.getProxyTarget(args);
		const proxy: unknown = new Proxy(proxyTarget, proxyHandler);

		return proxy as T;
	}*/
/*
	private static getProxyTarget(args: unknown[] | undefined): object {
		const isArgsHasCallback = args?.some(value => IpcP.isDispatchedCallback(value));
		const callbackProxyTarget = (): void => {};
		const objectProxyTarget = {};
		return isArgsHasCallback ? callbackProxyTarget : objectProxyTarget;
	}

	static isProxy(instance: unknown): instance is IIpcProxy {
		if (typeof instance !== 'object' || !instance) {
			return false;
		}

		const hasAllProxyMethods = proxyMethods.every(name => name in instance);

		return hasAllProxyMethods;
	}

	constructor(communicator: MessagePortCommunicator, arg: string[] | string) {
		this.communicator = communicator;

		if (typeof arg === 'string') {
			this.instanceIdRequest = Promise.resolve(arg);
			return;
		}

		this.instanceIdRequest = (async(): Promise<string> => {
			const body: IpcP.GetInstanceRequest = {
				contracts: arg,
			};

			const instanceRequest: IpcMessage = {
				headers: {
					[IpcP.HEADER_MESSAGE_TYPE]: IpcP.MESSAGE_GETINSTANCE,
				},
				body,
			};

			const resp = await communicator.send(instanceRequest);
			return IpcHelper.getResponseBody<IpcP.GetInstanceResponse>(resp).instanceId;
		})();
	}

	private async requestInstanceId(): Promise<string> {
		let instanceId: string;

		try {
			instanceId = await this.instanceIdRequest;
		}
		catch (error: unknown) {
			const message = `Remoting failure: ${ getMessageOfError(error) }`;
			throw new Error(message);
		}

		if (instanceId === '') {
			const message = 'Instance not resolved';
			// `Service with requested contract (${this.invokeContract}) not found` : 'Instance info not resolved';
			throw new Error(message);
		}

		this.instanceIdValue = instanceId;
		return instanceId;
	}

	instanceId(): Promise<string> {
		if (this.instanceIdValue !== null) {
			return Promise.resolve(this.instanceIdValue);
		}

		return this.requestInstanceId();
	}

	get(context: Record<string, unknown>, propKey: string): unknown {
		if (ignoreProxyMethod(propKey)) {
			return undefined;
		}

		if (isProxyMethod(propKey) && propKey in this) {
			// just
			return ((this as Record<string, unknown>)[propKey] as (...args: unknown[]) => unknown).bind(this);
		}

		const prop = this.properties[propKey];
		if (prop) {
			return prop;
		}

		const fieldInfo: ProxyFieldContext = {
			proxy: this,
			fieldData: context,
			propKey,
		};

		// proxy context must be a function, to allow using handler 'apply'.
		const propTarget = Object.assign(() => { }, fieldInfo);
		const propProxy = new Proxy(propTarget, ipcPropertyProxyHandler__);
		this.properties[propKey] = propProxy;

		return propProxy;
	}

	has(target: unknown, propKey: string): boolean {
		if (ignoreProxyMethod(propKey)) {
			return false;
		}
		return isProxyMethod(propKey);
	}

	async apply(target_: unknown, this_: unknown, args: unknown[]): Promise<unknown> {
		const instanceId = await this.instanceIdRequest;
		const result = await remoteInvoke(this.communicator, instanceId, '', args);

		if (IpcP.isDispatchedInstance(result)) {
			return IpcProxy.createForInstance<unknown>(result.dispatchedRemoteInstanceId);
		}

		if (IpcP.isDispatchedCallback(result)) {
			return (...cbArgs: unknown[]) => {
				ignorePromise(remoteInvoke(this.communicator, result.callbackId, '', cbArgs));
			};
		}
		return result;
	}

	dispose(): void {
		this.instanceIdRequest
			.then(instanceId => {
				if (!instanceId || instanceId === '') {
					return;
				}

				const body: IpcP.DisposeRequest = {
					instanceId,
				};

				ignorePromise(this.communicator.send({
					headers: {
						[IpcP.HEADER_MESSAGE_TYPE]: IpcP.MESSAGE_DISPOSE,
					},
					body,
				}));
			})
			.catch((error: unknown) => {
				const message = getMessageOfError(error);
				console.warn(`Error while awaiting instance info on .dispose:${ message }`);
			})
			.finally(() => {
				this.communicator.dispose();
			});
	}

	ipcProxyInstanceId(): Promise<string> {
		return this.instanceId();
	}

	ipcProxyCommunicator(): MessagePortCommunicator {
		return this.communicator;
	}
}
*/