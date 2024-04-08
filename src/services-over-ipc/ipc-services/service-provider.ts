import { MessageChannelMain, ipcRenderer, webContents } from "electron";

import { IpcCommunicator } from "../ipc-communication/communicators/ipc-communicator";
import { RendererIpcInbox } from "../ipc-communication/ipc-inbox/renderer-ipc-inbox";
import { IpcChannels, IpcMessage, IpcProtocol, RegisterInstanceRequest } from "../ipc-communication/ipc-protocol";
import { ServiceHost } from "./service-host";
import { MessagePortMainRequester } from "../ipc-communication/communicators/message-port-main-requester";
import { IpcProxy, Promisify } from "../ipc-communication/proxy/ipc-proxy";
import { ReflectionAspect, reflectLocalInstance } from "./reflection";

export type ServiceFactory = (contracts: string[], ...args: unknown[]) => unknown;

export interface IServiceProvider {
	provide(contracts: string[] | string, ...args: unknown[]): unknown;
}

export class ServiceProvider implements IServiceProvider {
	static readonly instance = new ServiceProvider(ipcRenderer ? new IpcCommunicator(new RendererIpcInbox(), (msg) => {
        ipcRenderer.send(IpcChannels.REQUEST_CHANNEL, msg);
    }) : undefined);

	private readonly factories: ServiceFactory[] = [];

	constructor(private communicator?: IpcCommunicator) {}

	registerFactory(contracts: string[] | undefined, factory: ServiceFactory): void {
		if (ipcRenderer && contracts && this.communicator) {
			const body: RegisterInstanceRequest = {
				contracts,
			};
			
			const instanceRegister: IpcMessage = {
				headers: {
					[IpcProtocol.HEADER_MESSAGE_TYPE]: IpcProtocol.MESSAGE_REGISTER_INSTANCE,
				},
				body,
			};

			this.communicator.send(instanceRegister);
		}

		this.factories.push(factory);
	}

	private tryCreate(contracts: string[] | string, ...args: unknown[]): unknown | undefined {
		const requestedContracts = contracts instanceof Array ? contracts : [contracts];

		for (const factory of this.factories) {
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
			throw new Error(`Local service with contracts [${ str }] not registered, and remoting not configured. Instance can not be created.`);
		}
		return instance;
	}
}

export class RemoteServiceProvider {
	static readonly instance = new RemoteServiceProvider();

	private tryCreate(host: ServiceHost, contracts: string[], ...args: unknown[]): unknown | undefined {
		const targetId = host.getHostId(contracts);

		if (!targetId) {
			return;
		}

		const targetHost = webContents.fromId(targetId);

		if (!targetHost) {
			return;
		}

		const channel = new MessageChannelMain();
		const portRequest = ServiceHost.createPortRequest(contracts);

		targetHost.postMessage(IpcChannels.REQUEST_CHANNEL, portRequest, [channel.port1]);

		const communicator = new MessagePortMainRequester(channel.port2);
		const instance = IpcProxy.create(communicator);

		return instance;
	}

	provide<T = unknown>(host: ServiceHost, contracts: string[], ...args: unknown[]): Promisify<T> {
		const instance = this.tryCreate(host, contracts, ...args) as Promisify<T>;

		if (!instance) {
			const str = contracts instanceof Array ? contracts.join(';') : contracts;
			throw new Error(`Local service with contracts [${ str }] not registered, and remoting not configured. Instance can not be created.`);
		}

		return instance;
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

	ServiceProvider.instance.registerFactory(contracts, factory);
}