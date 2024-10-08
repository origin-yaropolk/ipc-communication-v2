import { MessageChannelMain, WebContents, webContents } from 'electron';

import { MainCommunicator } from '../ipc-communication/communicators/main-communicator';
import { IpcHelper } from '../ipc-communication/ipc-core';
import { IIpcInbox } from '../ipc-communication/ipc-inbox/base-ipc-inbox';
import { hostDeadNotificationRequest, portRequest } from '../ipc-communication/ipc-messages';
import { InstanceRequest, IpcChannels, IpcProtocol, IpcRequest, RegisterInstanceRequest, UnregisterInstanceRequest } from '../ipc-communication/ipc-protocol';
import { AbstractServiceHost } from './abstract-service-host';
import { RemoteInstanceManager } from './remote-instance-manager';
import { ServiceProvider } from './service-provider';

export class ServiceHost extends AbstractServiceHost {
	private readonly knownHosts: Set<number> = new Set();
	private readonly remoteInstancesRegistry: Map<string, Set<number>> = new Map();
	private readonly instanceManager: RemoteInstanceManager;

	constructor(private inbox: IIpcInbox) {
		super(new ServiceProvider(inbox, (contract) => {
			return this.remoteInstancesRegistry.get(contract)?.values().next().value as number;
		}));

		this.initInboxing();
		this.instanceManager = new RemoteInstanceManager(this.serviceProvider);
	}

	private initInboxing(): void {
		const requestHandlers: { [key: string]: (requet: IpcRequest) => void; } = {
			[IpcProtocol.MESSAGE_REGISTER_INSTANCE]: (request: IpcRequest) => {
				const data = request.body as RegisterInstanceRequest;

				const hostId = IpcHelper.headerValue<number>(request, IpcProtocol.HEADER_HOST_ID) ?? 0;
				if (!hostId) {
					return IpcHelper.responseFailure(request, 'RegisterInstanse request must contain sender id');
				}

				const remoteHost = webContents.fromId(hostId);

				if (!remoteHost || remoteHost.isDestroyed()) {
					return IpcHelper.responseFailure(request, `ServiceHost for contracts [${ data.contracts[0] }] does not exists anymore`);
				}

				this.rememberHost(remoteHost);

				data.contracts.forEach(contract => {
					this.registerHostForContract(contract, hostId);
				});

				IpcHelper.response(request, 'Successful registered');
			},

			[IpcProtocol.MESSAGE_UNREGISTER_INSTANCE]: (request: IpcRequest) => {
				const data = request.body as UnregisterInstanceRequest;
				const hostId = IpcHelper.headerValue<number>(request, IpcProtocol.HEADER_HOST_ID) ?? 0;

				data.contracts.forEach(contract => {
					this.unregisterForContract(contract, hostId);
				});

				IpcHelper.response(request, 'Successful unregistered');
			},

			[IpcProtocol.MESSAGE_GET_INSTANCE]: (request: IpcRequest) => {
				const data = request.body as InstanceRequest;
				const [contract] = data.contracts;
				const specificHostId = data.specificHostId;
				const requestingHost = webContents.fromId(IpcHelper.headerValue<number>(request, IpcProtocol.HEADER_HOST_ID) ?? 0);

				if (!requestingHost) {
					return;
				}

				this.rememberHost(requestingHost);

				if (specificHostId === undefined) {
					const localInstance = this.instanceManager.tryGetInstance(data.contracts);
					if (localInstance) {
						const channel = new MessageChannelMain();

						localInstance.addCommunicator(new MainCommunicator(0, requestingHost.id, channel.port1));
						return IpcHelper.response(request, { port: channel.port2 });
					}
				}

				const remoteHosts = this.remoteInstancesRegistry.get(contract);

				// eslint-disable-next-line no-mixed-operators
				if (!remoteHosts || specificHostId && !remoteHosts.has(specificHostId)) {
					return IpcHelper.responseFailure(request, `Service with contracts [${ contract }] not registered, and remoting not configured. Instance can not be created.`);
				}

				const targetHost = webContents.fromId(remoteHosts.values().next().value as number);

				if (!targetHost) {
					return IpcHelper.responseFailure(request, `ServiceHost for contracts [${ contract }] does not exists anymore`);
				}

				const channel = new MessageChannelMain();

				targetHost.postMessage(IpcChannels.REQUEST_CHANNEL, portRequest({ id: targetHost.id, remoteId: requestingHost.id, contracts: data.contracts }), [channel.port1]);
				IpcHelper.response(request, {
					id: requestingHost.id,
					remoteId: targetHost.id,
					port: channel.port2,
				});
			},
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

	private registerHostForContract(contract: string, id: number): void {
		let hosts = this.remoteInstancesRegistry.get(contract);

		if (!hosts) {
			hosts = new Set();
			this.remoteInstancesRegistry.set(contract, hosts);
		}

		hosts.add(id);
	}

	private unregisterForContract(contract: string, id: number): void {
		const hosts = this.remoteInstancesRegistry.get(contract);

		if (hosts) {
			hosts.delete(id);
		}

		if (hosts?.size === 0) {
			this.remoteInstancesRegistry.delete(contract);
		}
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
			value.delete(remoteHostId);

			if (value.size === 0) {
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
			webContents.fromId(id)?.postMessage(IpcChannels.REQUEST_CHANNEL, hostDeadNotificationRequest({ id: removedHostId }));
		});
	}
}
