import { ServiceProvider } from './service-provider';
import { RemoteInvokableInstance } from './remote-invokable-instance';

export let ignoreIpcServiceProviderRequest__ = false;

export class RemoteInstanceManager {
	private instances: RemoteInvokableInstance[] = [];

	constructor(private provider: ServiceProvider) {}

	tryGetInstance(contracts: string[]): RemoteInvokableInstance | undefined {
		let instance = this.instances.find(inst => inst.id.includes(contracts[0]));

		if (!instance) {
			try {
				const newInstance = this.provider.provide<Record<string, unknown>>(contracts);
				instance = this.addInstance(newInstance);
			}
			catch (err) {
				return undefined;
			}
		}

		return instance;
	}

	private addInstance(instance: Record<string, unknown>): RemoteInvokableInstance {
		const entry = new RemoteInvokableInstance(instance);
		this.instances.push(entry);
		return entry;
	}
}
