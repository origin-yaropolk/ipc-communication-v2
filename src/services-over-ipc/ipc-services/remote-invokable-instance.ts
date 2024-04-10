import { Disposable, getUID } from '../ipc-communication/communicators/communicator-base';
import { ReflectionAspect, reflectLocalInstance } from './reflection';
import { MessagePortInbox } from '../ipc-communication/communicators/message-port-inbox';
import { IpcHelper } from '../ipc-communication/ipc-core';
import { InvokeRequest, IpcProtocol, IpcRequest, makeInboundArgs, makeOutboundValue } from '../ipc-communication/ipc-protocol';
import { Subscribable, Unsubscribable } from 'rxjs';
import { emitEvent } from '../ipc-communication/ipc-messages';

const instanceUidLength = 8;

function generateInstanceId(instance: unknown): string {
	const contracts = reflectLocalInstance(instance, ReflectionAspect.Contracts)?.contracts ?? [];
	const uid = getUID().slice(0, instanceUidLength);
	const id = contracts && contracts.length > 0 ? `${ uid }-${ contracts[0] }` : `${ uid }-anonymous`;
	return id;
}

interface EventSubscription {
	readonly subscription: Unsubscribable;
	readonly clientId: number;
}

export class RemoteInvokableInstance implements Disposable {
	readonly id: string;
	private readonly instance: Record<string, unknown>;
	private readonly inboxes: MessagePortInbox[] = [];
	private readonly eventSubscriptions: EventSubscription[] = [];

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
		if (IpcHelper.hasHeader(request, IpcProtocol.HEADER_MESSAGE_TYPE, IpcProtocol.MESSAGE_INVOKE)) {
			return this.handleInvokeRequest(request);
		}

		if (IpcHelper.hasHeader(request, IpcProtocol.HEADER_MESSAGE_TYPE, IpcProtocol.MESSAGE_EVENT_SUBSCRIBE)) {
			return this.handleSubscribeRequest(request);
		}
    }

	private handleInvokeRequest(request: IpcRequest) {
		const invoke = request.body as InvokeRequest;
		const args = makeInboundArgs(invoke.args);
		const method = this.instance[invoke.method];

		if (typeof method === 'undefined') {
			IpcHelper.responseFailure(request, `Instance does not provide invocable property: (${ invoke.method })`);
			return;
		}

		const result = (method as (...values: unknown[]) => unknown).apply( this.instance, args);
		IpcHelper.response(request, makeOutboundValue(result));
	}

	private handleSubscribeRequest(request: IpcRequest) {
		const invoke = request.body as InvokeRequest;
		const subscribable = Reflect.get(this.instance, invoke.method) as Subscribable<unknown>;
		if (!subscribable) {
			throw new Error(`Invalid (${ invoke.method }) event`);
		}

		const subscription = subscribable.subscribe({
			next: (value: unknown) => {
				request.responseChannel(emitEvent(invoke.method, [value]));
			},

			error: (error: unknown) => {
				//const message = getMessageOfError(error);
				//loggerService().error(`[InstanceEntry.eventSubscribe()] Event source(${ methodName }) emits an error:${ message }`, error);
			},
		});

		this.eventSubscriptions.push({
			subscription,
			clientId: 1
		});
		
		IpcHelper.response(request, 1);
	}

	dispose(): void {
		for (const inbox of this.inboxes) {
			inbox.dispose();
		}
	}
}
