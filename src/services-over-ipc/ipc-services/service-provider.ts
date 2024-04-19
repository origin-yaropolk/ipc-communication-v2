import { MessageChannelMain, ipcRenderer, webContents } from "electron";

import { IpcChannels, IpcMessage, IpcProtocol, PortRendererResponse } from "../ipc-communication/ipc-protocol";
import { IpcProxy, Promisify } from "../proxy/ipc-proxy";
import { ReflectionAspect, reflectLocalInstance } from "./reflection";
import { IIpcInbox } from "../ipc-communication/ipc-inbox/base-ipc-inbox";
import { IpcCommunicator } from "../ipc-communication/communicators/ipc-communicator";
import { instanceRequest, portRequest, registerInstanceRequest } from "../ipc-communication/ipc-messages";
import { MainCommunicator } from "../ipc-communication/communicators/main-communicator";
import { Communicator } from "../ipc-communication/communicators/communicator";
import { RendererCommunicator } from "../ipc-communication/communicators/renderer-communicator";

const isMainProcess = ipcRenderer === undefined;

function extractPort(body: unknown): MessagePort | undefined {
    return (body as PortRendererResponse).port;
}

export type ServiceFactory = (contracts: string[], ...args: unknown[]) => unknown;

export class ServiceProvider {
	private static readonly factories: ServiceFactory[] = [];
	private static communicator: IpcCommunicator | null;
	private static factoryRegistractionQueue: (()=>void)[] = [];
	private readonly proxies: Map<number, Map<string, unknown>> = new Map();
	private readonly proxiesQueue: Map<number, Map<string, unknown>> = new Map();

	constructor(private inbox: IIpcInbox, private proxyHostGetter?: (contract: string) => number | undefined) {
		if (!isMainProcess) {
			this.communicator();
			ServiceProvider.factoryRegistractionQueue.forEach(registerAction => registerAction());
			ServiceProvider.factoryRegistractionQueue = [];
		}
	}

	static registerFactory(contracts: string[] | undefined, factory: ServiceFactory): void {
		if (!isMainProcess && contracts) {
			const registerAction = () => { ServiceProvider.communicator?.send(registerInstanceRequest({contracts})); };

			if (ServiceProvider.communicator) {
				registerAction();
			}
			else {
				ServiceProvider.factoryRegistractionQueue.push(registerAction);
			}
		}

		ServiceProvider.factories.push(factory);
	}

	private tryCreate(contracts: string[] | string, ...args: unknown[]): unknown | undefined {
		const requestedContracts = contracts instanceof Array ? contracts : [contracts];

		for (const factory of ServiceProvider.factories) {
			const instance = factory(requestedContracts, ...args);
			if (instance) {
				return instance;
			}
		}

		return undefined;
	}

	provide<T = unknown>(contracts: string[], ...args: unknown[]): T {
		const instance: T = this.tryCreate(contracts, ...args) as T;

		if (!instance) {
			const str = contracts instanceof Array ? contracts.join(';') : contracts;
			throw new Error(`Local service with contracts [${ str }] not registered. Instance can not be created.`);
		}
		return instance;
	}

	provideProxy<T = unknown>(contracts: string[], specificHostId?: number): Promisify<T> {
		let proxy = this.findCachedProxy(contracts[0], specificHostId);

		if (proxy) {
			return proxy as Promisify<T>;
		}

		proxy = this.findQueuedProxy(contracts[0], specificHostId);

		if (proxy) {
			return proxy as Promisify<T>;
		}

		return this.enqueueProxyRequest(contracts, specificHostId) as Promisify<T>;
	}

	private async createCommunicators(contracts: string[], specificHostId?: number): Promise<Communicator> {
		if (isMainProcess) {
			if (!this.proxyHostGetter) {
				throw new Error('Proxy host getter not provided');
			}

			const hostId = specificHostId ?? this.proxyHostGetter(contracts[0]);

			if (!hostId) {
				throw new Error(`Remote instance with contacts [${contracts[0]}] not registerd. Instance can not be created.`);
			}

			const host = webContents.fromId(hostId);

			if (!host || host.isDestroyed()) {
				throw new Error(`Host for remote instance with contacts [${contracts[0]}] was destroyed. Instance can not be created.`);
			}

			const channel = new MessageChannelMain();
			host.postMessage(IpcChannels.REQUEST_CHANNEL, portRequest({id: hostId, remoteId: 0, contracts}), [channel.port1]);

			return new MainCommunicator(0, hostId, channel.port2);
		}

		const response = await this.communicator().send(instanceRequest({contracts, specificHostId}));
		const port = extractPort(response.body);

		if (!port) {
			throw new Error(`Remote host didn't provide port for instance with [${contracts[0]}]. Instance can not be created.`);
		}

		return new RendererCommunicator(response.headers[IpcProtocol.HEADER_HOST_ID], 0, port);
	}

	private communicator(): IpcCommunicator {
		if (isMainProcess) {
			throw new Error('Creating ServiceProvider communicator in main process');
		}

		const toMainSender = (message: IpcMessage) => { ipcRenderer.send(IpcChannels.REQUEST_CHANNEL, message) };

		if (!ServiceProvider.communicator) {
			ServiceProvider.communicator = new IpcCommunicator(this.inbox, toMainSender);
		}

		return ServiceProvider.communicator;
	}

	private findInDoubleMap(map: Map<number, Map<string, unknown>>, contract: string, hostId?: number): unknown | undefined {
		if (hostId !== undefined) {
			return map.get(hostId)?.get(contract);
		}

		for(const bucket of map.values()) {
			const proxy = bucket.get(contract);
			if (proxy) {
				return proxy;
			}
		}
	}

	private findCachedProxy(contract: string, hostId?: number): unknown | undefined {
		return this.findInDoubleMap(this.proxies, contract, hostId);
	}

	private findQueuedProxy(contract: string, hostId?: number): unknown | undefined {
		return this.findInDoubleMap(this.proxiesQueue, contract, hostId);
	}

	private enqueueProxyRequest(contracts: string[], hostId?: number): unknown {
		const proxyCommunicator = this.createCommunicators(contracts, hostId);
		const proxy = IpcProxy.create(proxyCommunicator);
		const actualHostId = hostId ?? -1;

		let bucket = this.proxiesQueue.get(actualHostId);
		if (!bucket) {
			bucket = new Map();
			this.proxiesQueue.set(actualHostId, bucket);
		}

		contracts.forEach(contract => {
			bucket.set(contract, proxy);
		});

		proxyCommunicator.then(communicator => {
			if (hostId !== -1 && communicator.remoteId !== actualHostId) {
				throw new Error(`Expected another host id. Expected - ${actualHostId}, got - ${communicator.remoteId}`);
			}

			let cacheBucket = this.proxies.get(communicator.remoteId);

			if (!cacheBucket) {
				cacheBucket = new Map();
				this.proxies.set(communicator.remoteId, cacheBucket);
			}

			contracts.forEach(contract => {
				cacheBucket.set(contract, proxy);
			});
		}).catch(err => {
			console.error(err);
		}).finally(() => {
			const queueBucket = this.proxiesQueue.get(actualHostId);
			
			contracts.forEach(contract => {
				queueBucket?.delete(contract);
			});

			if (queueBucket?.size === 0) {
				this.proxiesQueue.delete(actualHostId);
			}
		});

		return proxy;
	}
}

export function exposeSingleton(instance: unknown): void {
	const contracts = reflectLocalInstance(instance, ReflectionAspect.Contracts)?.contracts;
	if (!contracts) {
		throw new Error('Object does not provide contracts. Use Service decorator');
	}

	const factory = (requestedContracts: string[], ...args: unknown[]): unknown => {
		if (args.length > 0) {
			console.debug('Using non zero arguments for singleton factory');
		}
		const hasAllContracts = requestedContracts.every(c => contracts.includes(c));
		return hasAllContracts ? instance : undefined;
	};

	ServiceProvider.registerFactory(contracts, factory);
}