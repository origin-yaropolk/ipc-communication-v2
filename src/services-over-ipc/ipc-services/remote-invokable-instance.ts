import { ReflectionAspect, reflectLocalInstance } from './reflection';
import { IpcHelper } from '../ipc-communication/ipc-core';
import { InvokeRequest, IpcProtocol, IpcRequest, makeInboundArgs, makeOutboundValue } from '../ipc-communication/ipc-protocol';
import { Subscribable, Unsubscribable } from 'rxjs';
import { emitEventRequest } from '../ipc-communication/ipc-messages';
import { Communicator, RequestMode, getUID } from '../ipc-communication/communicators/communicator';

const instanceUidLength = 8;

function generateInstanceId(instance: unknown): string {
	const contracts = reflectLocalInstance(instance, ReflectionAspect.Contracts)?.contracts ?? [];
	const uid = getUID().slice(0, instanceUidLength);
	const id = contracts && contracts.length > 0 ? `${ uid }-${ contracts[0] }` : `${ uid }-anonymous`;
	return id;
}

export class RemoteInvokableInstance {
	readonly id: string;
	private readonly instance: Record<string, unknown>;
	private readonly communicatorsByRemoteId: Map<number, Communicator> = new Map();
	private readonly eventSubscriptions: Map<string, Unsubscribable> = new Map();

	constructor(instance: Record<string, unknown>) {
		this.id = generateInstanceId(instance);
		this.instance = instance;
	}

    addCommunicator(communicator: Communicator) {
        this.communicatorsByRemoteId.set(communicator.remoteId, communicator);

		communicator.onClosed.subscribe(() => {
			communicator.dispose();
			// todo: remove from array
		});
		
		communicator.onRequest.subscribe((request) => {
			this.handleRequest(request);
		});
    }

    private handleRequest(request: IpcRequest): void {
		if (IpcHelper.hasHeader(request, IpcProtocol.HEADER_REQUEST_TYPE, IpcProtocol.MESSAGE_INVOKE)) {
			return this.handleInvokeRequest(request);
		}

		if (IpcHelper.hasHeader(request, IpcProtocol.HEADER_REQUEST_TYPE, IpcProtocol.MESSAGE_EVENT_SUBSCRIBE)) {
			return this.handleSubscribeRequest(request);
		}

		if (IpcHelper.hasHeader(request, IpcProtocol.HEADER_REQUEST_TYPE, IpcProtocol.MESSAGE_EVENT_UNSUBSCRIBE)) {
			return this.handleUnsubscribeRequest(request);
		}

		if (IpcHelper.hasHeader(request, IpcProtocol.HEADER_REQUEST_TYPE, IpcProtocol.MESSAGE_DISPOSE)) {
			return this.handleDisposeRequest(request);
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

		const hostId = IpcHelper.headerValue<number>(request, IpcProtocol.HEADER_HOST_ID) ?? 0;
		const id = `${hostId}-${invoke.method}`;
		const subscription = subscribable.subscribe({
			next: (value: unknown) => {
				this.communicatorsByRemoteId.get(hostId)?.request(emitEventRequest({
					method: invoke.method,
					args: [value]
				}), RequestMode.FireAndForget);
			},

			error: (error: unknown) => {
				console.error(error);
			},
		});

		if (this.eventSubscriptions.has(id)) {
			return IpcHelper.responseFailure(request, 'Instance already have such subscription');
		}

		this.eventSubscriptions.set(id, subscription);

		IpcHelper.response(request, {});
	}

	private handleUnsubscribeRequest(request: IpcRequest) {
		const invoke = request.body as InvokeRequest;
		const hostId = IpcHelper.headerValue<number>(request, IpcProtocol.HEADER_HOST_ID);
		const id = `${hostId ?? 0}-${invoke.method}`
		const sub = this.eventSubscriptions.get(id);
		sub?.unsubscribe();
		this.eventSubscriptions.delete(id);

		IpcHelper.response(request, {});
	}

	private handleDisposeRequest(request: IpcRequest) {
		
	}

	dispose(): void {
		for (const communicator of this.communicatorsByRemoteId.values()) {
			communicator.dispose();
		}
	}
}
