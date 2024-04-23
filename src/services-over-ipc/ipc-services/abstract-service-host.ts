import { ServiceProvider } from './service-provider';

export abstract class AbstractServiceHost {
	constructor(protected readonly serviceProvider: ServiceProvider) {}

	get provider(): ServiceProvider {
		return this.serviceProvider;
	}
}
