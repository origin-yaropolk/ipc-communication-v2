
import { Disposable, getUID } from './communicators/communicator-base';
import { MessagePortCommunicator } from './communicators/message-port-communicator';
import { ReflectionAspect, reflectLocalInstance } from './reflection';

const instanceUidLength = 8;

function generateInstanceId(instance: unknown): string {
	const contracts = reflectLocalInstance(instance, ReflectionAspect.Contracts)?.contracts ?? [];
	const uid = getUID().slice(0, instanceUidLength);
	const id = contracts && contracts.length > 0 ? `${ uid }-${ contracts[0] }` : `${ uid }-anonymous`;
	return id;
}

export class RemoteInstanceEntry implements Disposable {
	communicators: MessagePortCommunicator[] = [];

	readonly id: string;
	readonly instance: Record<string, unknown>;

	constructor(instance: Record<string, unknown>) {
		this.id = generateInstanceId(instance);
		this.instance = instance;
	}

    addCommunicator(communicator: MessagePortCommunicator) {
        this.communicators.push(communicator);

        
    }

	dispose(): void {
		for (const communicator of this.communicators) {
			communicator.dispose();
		}
	}
}
