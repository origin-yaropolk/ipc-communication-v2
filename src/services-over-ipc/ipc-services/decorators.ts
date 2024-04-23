import 'reflect-metadata';

import { ServiceFactory, ServiceProvider } from './service-provider';

export const SERVICE_CONTRACTS_METAKEY = Symbol('ServiceContracts');
// eslint-disable-next-line @typescript-eslint/ban-types
export type GenericConstructor<T = {}> = new (...args: any[]) => T;

export enum ServiceLifeTime {
	Transient,
	Singleton,
}

export function Service(...contracts: string[]) {
	return (constructor: GenericConstructor): void => {
		Reflect.defineMetadata(SERVICE_CONTRACTS_METAKEY, contracts, constructor);
	};
}

export function ExposeService(lifetime: ServiceLifeTime) {
	return (constructor: GenericConstructor): void => {
		const contracts = Reflect.getMetadata(SERVICE_CONTRACTS_METAKEY, constructor) as string[] | undefined;

		const hasAllContracts = (requestedContracts: string[]): boolean => {
			if (!contracts) {
				console.error(`Service can not be exposed, because Service meta data not provided:[${ constructor.name }]`);
				return false;
			}
			return requestedContracts.every(requestedContract => contracts.indexOf(requestedContract) >= 0);
		};

		if (lifetime === ServiceLifeTime.Transient) {
			ServiceProvider.registerFactory(contracts, (requestedContracts: string[], ...args: unknown[]) => {
				if (!hasAllContracts(requestedContracts)) {
					return null;
				}

				return new constructor(...args);
			});
		}
		else {
			const singletonFactory: ServiceFactory = (() => {
				let instance: unknown = null;

				return (requestedContracts: string[], ...args: unknown[]): unknown => {
					if (!hasAllContracts(requestedContracts)) {
						return null;
					}

					if (args.length > 0) {
						console.error(`Service (${ constructor.name }) exposed as singleton and can not accept any construction arguments.`);
					}

					if (instance === null) {
						instance = new constructor();
					}
					return instance;
				};
			})();
			ServiceProvider.registerFactory(contracts, singletonFactory);
		}
	};
}
