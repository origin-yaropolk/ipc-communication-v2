import { MessageChannelMain, ipcRenderer, webContents } from "electron";

import { IpcChannels, IpcMessage, IpcProtocol, PortRendererResponse } from "../ipc-communication/ipc-protocol";
import { IpcProxy, Promisify } from "../ipc-communication/proxy/ipc-proxy";
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
	private readonly proxies: Map<string, unknown> = new Map();

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

	async provideProxy<T = unknown>(contracts: string[], ...args: unknown[]): Promise<Promisify<T>> {
		let proxy = this.proxies.get(contracts[0]);

        if (!proxy) {
			const proxyCommunicator = await this.createCommunicators(contracts);
            proxy = IpcProxy.create(proxyCommunicator);
			contracts.forEach(contract => {
				this.proxies.set(contract, proxy);
			});
        }

		return Promise.resolve(proxy as Promisify<T>);
	}

	private async createCommunicators(contracts: string[]): Promise<Communicator> {
		if (isMainProcess) {
			if (!this.proxyHostGetter) {
				throw new Error('Proxy host getter not provided');
			}

			const hostId = this.proxyHostGetter(contracts[0]);

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

		const response = await this.communicator().send(instanceRequest({contracts}));
		const port = extractPort(response.body);

		if (!port) {
			throw new Error(`Remote host didn't provide port for instance with [${contracts[0]}]. Instance can not be created.`);
		}

		// const requester = new MessagePortRendererRequester(port, response.headers[IpcProtocol.HEADER_HOST_ID]);
		// const inbox = new MessagePortRendererInbox(response.headers[IpcProtocol.HEADER_HOST_ID], port);

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