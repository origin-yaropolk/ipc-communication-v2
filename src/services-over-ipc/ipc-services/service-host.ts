import { MessageChannelMain, WebContents, webContents } from "electron";
import { RemoteInstanceManager } from "./remote-instance-manager";
import { IIpcInbox } from "../ipc-communication/ipc-inbox/base-ipc-inbox";
import { InstanceRequest, IpcChannels, IpcProtocol, IpcRequest, RegisterInstanceRequest, UnregisterInstanceRequest } from "../ipc-communication/ipc-protocol";
import { IpcHelper } from "../ipc-communication/ipc-core";
import { hostDeadNotificationRequest, portRequest } from '../ipc-communication/ipc-messages';
import { ServiceProvider } from "./service-provider";
import { MainCommunicator } from "../ipc-communication/communicators/main-communicator";

export class ServiceHost {
    private readonly knownHosts: Set<number> = new Set();
    private readonly remoteInstancesRegistry: Map<string, number> = new Map();
    private readonly serviceProvider;
    private readonly instanceManager;

    constructor(private inbox: IIpcInbox) {
        this.initInboxing();

        this.serviceProvider = new ServiceProvider(this.inbox, (contract) => {
            return this.remoteInstancesRegistry.get(contract);
        });

        this.instanceManager = new RemoteInstanceManager(this.serviceProvider);
    }

    get provider(): ServiceProvider {
        return this.serviceProvider;
    }

    private initInboxing(): void {
        const requestHandlers: { [key: string]: (requet: IpcRequest) => void; } = {
            [IpcProtocol.MESSAGE_REGISTER_INSTANCE]: (request: IpcRequest) => {
                const data = request.body as RegisterInstanceRequest

                const hostId = IpcHelper.headerValue<number>(request, IpcProtocol.HEADER_HOST_ID) ?? 0;
                if (!hostId) {
                    return IpcHelper.responseFailure(request, 'RegisterInstanse request must contain sender id');
                }

                const remoteHost = webContents.fromId(hostId);

                if (!remoteHost || remoteHost.isDestroyed()) {
                    return IpcHelper.responseFailure(request, `ServiceHost for contracts [${data.contracts[0]}] does not exists anymore`);
                }

                this.rememberHost(remoteHost);

                data.contracts.forEach(contract => {
                    this.remoteInstancesRegistry.set(contract, hostId);
                });

                IpcHelper.response(request, 'Successful registered');
            },

            [IpcProtocol.MESSAGE_UNREGISTER_INSTANCE]: (request: IpcRequest) => {
                const data = request.body as UnregisterInstanceRequest

                data.contracts.forEach(contract => {
                    this.remoteInstancesRegistry.delete(contract);
                });

                IpcHelper.response(request, 'Successful unregistered');
            },

            [IpcProtocol.MESSAGE_GET_INSTANCE]: (request: IpcRequest) => {
                const data = request.body as InstanceRequest
                const [contract] = data.contracts;
                const requestingHost = webContents.fromId(IpcHelper.headerValue<number>(request, IpcProtocol.HEADER_HOST_ID) ?? 0);

                if (!requestingHost) {
                    return;
                }

                this.rememberHost(requestingHost);

                const localInstance = this.instanceManager.tryGetInstance(data.contracts);
                if (localInstance) {
                    const channel = new MessageChannelMain();

                    localInstance.addCommunicator(new MainCommunicator(0, requestingHost.id, channel.port1,));
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
               
                targetHost.postMessage(IpcChannels.REQUEST_CHANNEL, portRequest({id: targetHost.id, remoteId: requestingHost.id, contracts: data.contracts}), [channel.port1]);
                IpcHelper.response(request, { 
                    id: requestingHost.id,
                    remoteId: targetHost.id,
                    port: channel.port2
                });
            }
        };

        this.inbox.onRequest.subscribe((request: IpcRequest) => {
			const messageType = IpcHelper.headerValue<string>(request, IpcProtocol.HEADER_REQUEST_TYPE);
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

    private rememberHost(host: WebContents): void {
        if (host.isDestroyed()) {
            this.knownHosts.delete(host.id);
        }

        if (this.knownHosts.has(host.id)) {
            return;
        }

        this.knownHosts.add(host.id);
        this.setupHostAliveWatchdog(host);
    }

    private setupHostAliveWatchdog(host: WebContents): void {
        host.once('destroyed', () => {
            this.removeRemoteHost(host.id);
            this.notifyOthers(host.id);
        });
    }

    private removeRemoteHost(remoteHostId: number): void {
        const contractsForDelete: string[] = [];

        this.remoteInstancesRegistry.forEach((value, key) => {
            if (value === remoteHostId) {
                contractsForDelete.push(key);
            }
        });

        contractsForDelete.forEach(contract => {
            this.remoteInstancesRegistry.delete(contract);
        });
        
        this.knownHosts.delete(remoteHostId);
        this.instanceManager.onHostDead(remoteHostId);
    }

    private notifyOthers(removedHostId: number): void {
        this.knownHosts.forEach(id => {
            webContents.fromId(id)?.postMessage(IpcChannels.REQUEST_CHANNEL, hostDeadNotificationRequest({id: removedHostId}))
        });
    }
}