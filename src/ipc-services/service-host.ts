import { MessageChannelMain, webContents } from "electron";
import { IIpcInbox, IpcMessage, IpcRequest, REQUEST_CHANNEL } from "../ipc-communication/interfaces";
import * as IpcP from '../ipc-communication/ipc-protocol';
import { IpcHelper } from "../ipc-communication/ipc-core";
import { RemoteInstanceManager } from "./remote-instance-manager";
import { MessagePortMainInbox } from "../ipc-communication/communicators/message-port-main-inbox";

export class ServiceHost {
    private readonly remoteInstancesRegistry: Map<string, number> = new Map();

    constructor(private inbox: IIpcInbox, private instanceManager: RemoteInstanceManager) {
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
                const data = request.body as IpcP.InstanceRequest
                const [contract] = data.contracts;

                const localInstance = this.instanceManager.tryGetInstance(data.contracts);

                if (localInstance) {
                    const channel = new MessageChannelMain();

                    localInstance.addInbox(new MessagePortMainInbox(channel.port1));
                    return IpcHelper.response(request, {port: channel.port2});
                }

                const remoteHostId = this.remoteInstancesRegistry.get(contract);

                if (!remoteHostId) {
                    return IpcHelper.responseFailure(request, `Service with contracts [${contract}] not registered, and remoting not configured. Instance can not be created.`);
                }
                
                const targetHost = webContents.fromId(remoteHostId);

                if (!targetHost) {
                    return IpcHelper.responseFailure(request, `ServiceHost for contracts [${contract}] does not exists anymore`);
                }

                const channel = new MessageChannelMain();
                const portRequest = ServiceHost.createPortRequest(data.contracts);

                targetHost.postMessage(REQUEST_CHANNEL, portRequest, [channel.port1]);
                IpcHelper.response(request, {port: channel.port2});
            },

            [IpcP.MESSAGE_HANDSHAKE]: (request: IpcRequest) => {
                const remoteHostId = request.webContentsId;

                if (!remoteHostId) {
                    return IpcHelper.responseFailure(request, 'Hadshake request must provide host id');
                }

                const remoteHost = webContents.fromId(remoteHostId);

                if (!remoteHost || remoteHost.isDestroyed()) {
                    return IpcHelper.responseFailure(request, 'Hadshake request recieved from destroyed host');
                }

                const hostAliveWatchDog = () => {
                    this.removeRemoteHost(remoteHostId);
                };

                remoteHost.once('destroyed', hostAliveWatchDog);

                return IpcHelper.response(request, 'Success');
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

    public getHostId(contracts: string[]): number | undefined {
        return this.remoteInstancesRegistry.get(contracts[0]);
    }

    private removeRemoteHost(remoteHostId: number): void {

    }

    static createPortRequest(contracts: string[]): IpcMessage {
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