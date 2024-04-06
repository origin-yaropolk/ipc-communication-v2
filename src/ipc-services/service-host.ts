import { MessageChannelMain, MessagePortMain, webContents } from "electron";
import { IIpcInbox, IpcMessage, IpcRequest, REQUEST_CHANNEL } from "../ipc-communication/interfaces";
import * as IpcP from '../ipc-communication/ipc-protocol';
import { IpcHelper } from "../ipc-communication/ipc-core";

export class ServiceHost {
    private readonly remoteInstancesRegistry: Map<string, number> = new Map();

    constructor(private inbox: IIpcInbox) {
        this.initInboxing();
    }

    private initInboxing(): void {
        const requestHandlers: { [key: string]: (requet: IpcRequest) => void; } = {
            [IpcP.MESSAGE_REGISTER_INSTANCE]: (request: IpcRequest) => {
                if (!request.webContentsId) {
                    return IpcHelper.responseFailure(request, 'RegisterInstanse request must contain sender id');
                }

                const data = request.body as IpcP.RegisterInstanceRequest
                const id = request.webContentsId;

                data.contracts.forEach(contract => {
                    this.remoteInstancesRegistry.set(contract, id);
                });

                IpcHelper.response(request, 'Successful registered');
            },

            [IpcP.MESSAGE_UNREGISTER_INSTANCE]: (request: IpcRequest) => {
                const data = request.body as IpcP.UnregisterInstanceRequest

                data.contracts.forEach(contract => {
                    this.remoteInstancesRegistry.delete(contract);
                });

                IpcHelper.response(request, 'Successful unregistered');
            },

            [IpcP.MESSAGE_GET_INSTANCE]: (request: IpcRequest) => {
                // TODO: find local instance
                // ****
                // -----

                const data = request.body as IpcP.InstanceRequest

                const [contract] = data.contracts;

                const remoteInstanceHostId = this.remoteInstancesRegistry.get(contract);

                if (!remoteInstanceHostId) {
                    return IpcHelper.responseFailure(request, `Service with contracts [${contract}] not registered, and remoting not configured. Instance can not be created.`);
                }
                
                const targetHost = webContents.fromId(remoteInstanceHostId);

                if (!targetHost) {
                    return IpcHelper.responseFailure(request, `ServiceHost for contracts [${contract}] does not exists anymore`);
                }

                const channel = new MessageChannelMain();

                const portRequest = ServiceHost.portRequest(data.contracts);

                targetHost.postMessage(REQUEST_CHANNEL, portRequest, [channel.port1]);

                IpcHelper.response(request, {port: channel.port2});
            },
        };

        this.inbox.onRequest.subscribe((request: IpcRequest) => {
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

    private static portRequest(contracts: string[]): IpcMessage {
        const body: IpcP.PortRequest = {
            contracts: contracts,
        };
        
        const portRequest: IpcMessage = {
            headers: {
                [IpcP.HEADER_MESSAGE_TYPE]: IpcP.MESSAGE_PORT_REQUEST,
            },
            body
        };

        return portRequest;
    }
}