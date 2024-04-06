import { Disposable, getUID } from '../ipc-communication/communicators/communicator-base';
import { ReflectionAspect, reflectLocalInstance } from './reflection';
import { MessagePortInbox } from '../ipc-communication/communicators/message-port-inbox';
import { IpcRequest } from '../ipc-communication/interfaces';
import { IpcHelper } from '../ipc-communication/ipc-core';
import * as IpcP from '../ipc-communication/ipc-protocol';

const instanceUidLength = 8;

function generateInstanceId(instance: unknown): string {
	const contracts = reflectLocalInstance(instance, ReflectionAspect.Contracts)?.contracts ?? [];
	const uid = getUID().slice(0, instanceUidLength);
	const id = contracts && contracts.length > 0 ? `${ uid }-${ contracts[0] }` : `${ uid }-anonymous`;
	return id;
}

export class RemoteInvokableInstance implements Disposable {
	readonly id: string;
	private readonly instance: Record<string, unknown>;
	private readonly inboxes: MessagePortInbox[] = [];

	constructor(instance: Record<string, unknown>) {
		this.id = generateInstanceId(instance);
		this.instance = instance;
	}

    addInbox(inbox: MessagePortInbox) {
        this.inboxes.push(inbox);

		inbox.onClosed.subscribe(() => {
			inbox.dispose();
			// todo: remove from array
		});
		
		inbox.onRequest.subscribe((request) => {
			this.handleRequest(request);
		});
    }

    private handleRequest(request: IpcRequest): void {
		if (IpcHelper.hasHeader(request, IpcP.HEADER_MESSAGE_TYPE, IpcP.MESSAGE_INVOKE)) {
			return this.handleInvokeRequest(request);
		}
    }

	private handleInvokeRequest(request: IpcRequest) {
		const invoke = request.body as IpcP.InvokeRequest;
		const args = IpcP.makeInboundArgs(invoke.args);
		const method = this.instance[invoke.method];

		if (typeof method === 'undefined') {
			IpcHelper.responseFailure(request, `Instance does not provide invocable property: (${ invoke.method })`);
			return;
		}

		const result = (method as (...values: unknown[]) => unknown).apply( this.instance, args);
		IpcHelper.response(request, IpcP.makeOutboundValue(result));
	}

	dispose(): void {
		for (const inbox of this.inboxes) {
			inbox.dispose();
		}
	}
}
