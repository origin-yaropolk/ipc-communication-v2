import { Promisify } from "../ipc-communication/proxy/ipc-proxy";
import { ReflectionAspect, reflectLocalInstance } from "../ipc-communication/reflection";

export type ServiceFactory = (contracts: string[], ...args: unknown[]) => unknown;

export interface IServiceProvider {
	provide(contracts: string[] | string, ...args: unknown[]): unknown;
}

export class ServiceProvider implements IServiceProvider {
	static readonly instance = new ServiceProvider();

	private readonly factories: ServiceFactory[] = [];

	registerFactory(factory: ServiceFactory): void {
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

export class RemoteServiceProvider implements IServiceProvider {
	static readonly instance = new RemoteServiceProvider();

	private tryCreate(contracts: string[], ...args: unknown[]): unknown | undefined {
		return undefined;
	}

	provide<T = unknown>(contracts: string[], ...args: unknown[]): Promisify<T> {
		const instance = this.tryCreate(contracts, ...args) as Promisify<T>;

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

	ServiceProvider.instance.registerFactory(factory);
}