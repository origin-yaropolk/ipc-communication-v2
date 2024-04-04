
export type ServiceFactory = (contracts: string[], ...args: unknown[]) => unknown;

export interface IServiceProvider {
	tryCreate(contracts: string[] | string, ...args: unknown[]): unknown;
}
export class ServiceProvider implements IServiceProvider {
	static readonly instance = new ServiceProvider();

	private readonly factories: ServiceFactory[] = [];
	private readonly providers: IServiceProvider[] = [];

	registerFactory(factory: ServiceFactory): void {
		this.factories.push(factory);
	}

	registerProvider(provider: IServiceProvider): void {
		this.providers.push(provider);
	}

	tryCreate(contracts: string[] | string, ...args: unknown[]): unknown | undefined {
		const requestedContracts = contracts instanceof Array ? contracts : [contracts];

		for (const factory of this.factories) {
			const instance = factory(requestedContracts, ...args);
			if (instance) {
				return instance;
			}
		}

		for (const provider of this.providers) {
			const instance = provider.tryCreate(requestedContracts, ...args);
			if (instance) {
				return instance;
			}
		}

		return undefined;
	}

	/**
	* Generic "T" can't include fields of BehaviorSubject type,
	* because IpcPropertyProxy doesn't support BehaviorSubject type from Rx.js

	* You can read more in {@link https://git.xtools.tv/tv/desktop-application/-/blob/2/src/communication/communication.md#using-services Docs communication}
	* and in source code {@link https://git.xtools.tv/tv/desktop-application/-/blob/2/src/communication/ipc-proxy.ts#L76 IpcPropertyProxy.makeSubscribe}
	 */
	create<T = unknown>(contracts: string[] | string, ...args: unknown[]): T {
		const instance: T = this.tryCreate(contracts, ...args) as T;

		if (!instance) {
			const str = contracts instanceof Array ? contracts.join(';') : contracts;
			throw new Error(`Local service with contracts [${ str }] not registered, and remoting not configured. Instance can not be created.`);
		}
		return instance;
	}

}

export type GenericConstructor<T = {}> = new (...args: any[]) => T;

export function AdditionalServiceProvider() {
	return (constructor: GenericConstructor): void => {
		const provider: unknown = new constructor();
		ServiceProvider.instance.registerProvider(provider as IServiceProvider);
	};
}

@AdditionalServiceProvider()
class IpcHostServiceProvider implements IServiceProvider {
	tryCreate(contracts: string | string[], ...args: any[]): unknown {
		const contractsArray = contracts instanceof Array ? contracts : [contracts];
		return;
	}
}