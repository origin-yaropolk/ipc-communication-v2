import { Subscribable, Unsubscribable } from 'rxjs';

import { ignorePromise } from '../../utils';
import { Communicator, getUID, RequestMode } from '../ipc-communication/communicators/communicator';
import { IpcHelper } from '../ipc-communication/ipc-core';
import { emitEventRequest } from '../ipc-communication/ipc-messages';
import { InvokeRequest, IpcProtocol, IpcRequest, makeInboundArgs, makeOutboundValue } from '../ipc-communication/ipc-protocol';
import { ReflectionAspect, reflectLocalInstance } from './reflection';

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

	addCommunicator(communicator: Communicator): void {
		this.communicatorsByRemoteId.set(communicator.remoteId, communicator);

		communicator.onClosed.subscribe(() => {
			communicator.dispose();
			// todo: remove from array
		});

		communicator.onRequest.subscribe((request) => {
			this.handleRequest(request);
		});
	}

	onHostDead(deadHostId: number): void {
		const idsForDelete: string[] = [];
		for (const [id, sub] of this.eventSubscriptions) {
			if (id.split('-').at(0) === deadHostId.toString()) {
				sub.unsubscribe();
				idsForDelete.push(id);
			}
		}

		idsForDelete.forEach(id => {
			this.eventSubscriptions.delete(id);
		});

		this.communicatorsByRemoteId.get(deadHostId)?.dispose();
		this.communicatorsByRemoteId.delete(deadHostId);
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

	private handleInvokeRequest(request: IpcRequest): void {
		const invoke = request.body as InvokeRequest;
		const args = makeInboundArgs(invoke.args);
		const method = this.instance[invoke.method];

		if (typeof method === 'undefined') {
			IpcHelper.responseFailure(request, `Instance does not provide invocable property: (${ invoke.method })`);
			return;
		}

		const result = (method as (...values: unknown[]) => unknown).apply(this.instance, args);
		IpcHelper.response(request, makeOutboundValue(result));
	}

	private handleSubscribeRequest(request: IpcRequest): void {
		const invoke = request.body as InvokeRequest;
		const subscribable = Reflect.get(this.instance, invoke.method) as Subscribable<unknown>;
		if (!subscribable) {
			throw new Error(`Invalid (${ invoke.method }) event`);
		}

		const hostId = IpcHelper.headerValue<number>(request, IpcProtocol.HEADER_HOST_ID) ?? 0;
		const id = `${ hostId }-${ invoke.method }`;
		const subscription = subscribable.subscribe({
			next: (value: unknown) => {
				const requestPromise = this.communicatorsByRemoteId.get(hostId)?.request(emitEventRequest({
					method: invoke.method,
					args: [value],
				}), RequestMode.FireAndForget);

				if (requestPromise) {
					ignorePromise(requestPromise);
				}
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

	private handleUnsubscribeRequest(request: IpcRequest): void {
		const invoke = request.body as InvokeRequest;
		const remoteId = IpcHelper.headerValue<number>(request, IpcProtocol.HEADER_HOST_ID);
		const id = `${ remoteId ?? 0 }-${ invoke.method }`;
		const sub = this.eventSubscriptions.get(id);
		sub?.unsubscribe();
		this.eventSubscriptions.delete(id);

		IpcHelper.response(request, {});
	}

	private handleDisposeRequest(request: IpcRequest): void {
		const remoteId = IpcHelper.headerValue<number>(request, IpcProtocol.HEADER_HOST_ID) ?? 0;

		this.onHostDead(remoteId);
	}

	dispose(): void {
		for (const communicator of this.communicatorsByRemoteId.values()) {
			communicator.dispose();
		}
	}
}
