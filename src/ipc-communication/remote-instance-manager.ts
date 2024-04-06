import { MessageChannelMain } from 'electron';
import { ServiceProvider } from '../ipc-services/service-provider';
import { IIpcInbox, IpcMessage, IpcRequest, REQUEST_CHANNEL } from './interfaces';
import { IpcHelper } from './ipc-core';
import * as IpcP from './ipc-protocol';
import { RemoteInstanceEntry } from './remote-instance-entry';
import { MessagePortMainInbox } from './communicators/message-port-main-inbox';
import { ServiceLocator } from '../ipc-services/service-locator';
import { MessageChannelConstructor } from './message-channel-constructor';
import { IpcCommunicator } from './communicators/ipc-communicator';
import { MessagePortRendererInbox } from './communicators/message-port-renderer-inbox';


export let ignoreIpcServiceProviderRequest__ = false;

export class RemoteInstanceManager {
	private instances: RemoteInstanceEntry[] = [];

	constructor(inbox: IIpcInbox) {
        const requestHandlers: { [key: string]: (requet: IpcRequest) => void; } = {
            [IpcP.MESSAGE_PORT_REQUEST]: (request: IpcRequest) => {
				const data = request.body as IpcP.PortRequest;
				const port = request.port;

				if (!port) {
					return IpcHelper.responseFailure(request, `Request does not contains port`);
				}

				let instance = this.instances.find(inst => inst.id.includes(data.contracts[0]));

				if (!instance) {
					const newInstance = ServiceProvider.instance.provide<Record<string, unknown>>(data.contracts);
					instance = this.addInstance(newInstance);

					if (!instance) {
						return IpcHelper.responseFailure(request, `No service provider found for contracts [${data.contracts[0]}]`);
					}
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

	addInstance(instance: Record<string, unknown>): RemoteInstanceEntry {
		const entry = new RemoteInstanceEntry(instance);
		this.instances.push(entry);
		return entry;
	}
}
