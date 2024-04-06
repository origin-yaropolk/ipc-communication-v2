import { MessageChannelMain } from 'electron';
import { ServiceProvider } from './service-provider';
import { IIpcInbox, IpcMessage, IpcRequest, REQUEST_CHANNEL } from '../ipc-communication/interfaces';
import { IpcHelper } from '../ipc-communication/ipc-core';
import * as IpcP from '../ipc-communication/ipc-protocol';
import { RemoteInvokableInstance } from './remote-invokable-instance';
import { MessagePortMainInbox } from '../ipc-communication/communicators/message-port-main-inbox';
import { ServiceLocator } from './service-locator';
import { MessageChannelConstructor } from '../ipc-communication/message-channel-constructor';
import { IpcCommunicator } from '../ipc-communication/communicators/ipc-communicator';
import { MessagePortRendererInbox } from '../ipc-communication/communicators/message-port-renderer-inbox';


export let ignoreIpcServiceProviderRequest__ = false;

export class RemoteInstanceManager {
	private instances: RemoteInvokableInstance[] = [];

	constructor(inbox: IIpcInbox) {
        const requestHandlers: { [key: string]: (requet: IpcRequest) => void; } = {
            [IpcP.MESSAGE_PORT_REQUEST]: (request: IpcRequest) => {
				const data = request.body as IpcP.PortRequest;
				const port = request.port;

				if (!port) {
					return IpcHelper.responseFailure(request, `Request does not contains port`);
				}

				const instance = this.tryGetInstance(data.contracts);

				if (!instance) {
					return IpcHelper.responseFailure(request, `No service provider found for contracts [${data.contracts[0]}]`);
				}

				instance.addInbox(new MessagePortRendererInbox(port));

				IpcHelper.response(request, 'Port successfully added');
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
	}

	tryGetInstance(contracts: string[]): RemoteInvokableInstance | undefined {
		let instance = this.instances.find(inst => inst.id.includes(contracts[0]));

		if (!instance) {
			try {
				const newInstance = ServiceProvider.instance.provide<Record<string, unknown>>(contracts);
				instance = this.addInstance(newInstance);
			}
			catch (err) {
				return undefined;
			}
		}

		return instance;
	}

	private addInstance(instance: Record<string, unknown>): RemoteInvokableInstance {
		const entry = new RemoteInvokableInstance(instance);
		this.instances.push(entry);
		return entry;
	}
}
