import { ipcMain } from 'electron';

// import { serviceHost } from './ipc-core';

const isMainProcess = typeof ipcMain !== 'undefined';

export interface InstanceBaseRequest {
	instanceId: string;
}

export interface InvokeRequest extends InstanceBaseRequest {
	method: string;
	args: any[];
}

export type DisposeRequest = InstanceBaseRequest;

export interface GetInstanceRequest {
	contracts: string[];
}

export interface RegisterInstanceRequest {
    contracts: string[];
}

export type GetInstanceResponse = InstanceBaseRequest;


export interface DispatchedInstance {
	dispatchedRemoteInstanceId: string;
}

export interface DispatchedCallback {
	callbackId: string;
}

export const HEADER_MESSAGE_TYPE = 'message-type';

export const MESSAGE_REGISTERINSTANCE = 'host:register-instance';
export const MESSAGE_GETINSTANCE = 'host:get-instance';

export const MESSAGE_INVOKE = 'instance:invoke';
export const MESSAGE_DISPOSE = 'instance:dispose';
export const MESSAGE_EVENT_SUBSCRIBE = 'instance:event_subscribe';
export const MESSAGE_EVENT_UNSUBSCRIBE = 'instance:event_unsubscribe';
export const MESSAGE_EVENT_NEXT = 'instance:event_next';
export const MESSAGE_REFLECT = 'instance:reflect';
export const MESSAGE_IS_ALIVE = 'instance:is-alive';
export const MESSAGE_TRANSFER_PORT = 'instance:transfer-port';

/**
 * Generic check that value is not just 'data',
 * but actually is behaviour if any of its properties is a function.
 */
function isServiceInstance(value: any): boolean {
	if (typeof value !== 'object' || value instanceof Array) {
		return false;
	}

	const properties = Object.getOwnPropertyDescriptors(value);

	// eslint-disable-next-line guard-for-in
	for (const key in properties) {
		const desc = properties[key];
		if (typeof desc.value === 'function') {
			return true;
		}
	}

	const proto: unknown = Object.getPrototypeOf(value);
	const ctor = (proto as { constructor?: unknown; })?.constructor;

	return typeof ctor === 'object' && ctor !== null && isServiceInstance(proto);
}

export function isDispatchedInstance(value: unknown): value is DispatchedInstance {
	return typeof value === 'object' && value !== null && 'dispatchedRemoteInstanceId' in value;
}

export function isDispatchedCallback(value: unknown): value is DispatchedCallback {
	return typeof value === 'object' && value !== null && 'callbackId' in value;
}

/**
 * Making value that must be sent out throug ipc services protocol.
 * Any function or service instance value will be transformed into remote-instance-info, all other values will no be modified
 */
export function makeOutboundValue(value: unknown): unknown {
	//if (typeof value === 'function') {
	//	const callbackInstance: DispatchedCallback = {
	//		callbackId: serviceHost().registerRemoteInstance(value),
	//	};
//
	//	return callbackInstance;
	//}

	if (!value || typeof value !== 'object') {
		return value;
	}

	if (!isMainProcess && value instanceof DOMException) {
		return Error(value.message);
	}

	if (!isServiceInstance(value)) {
		return value;
	}

	const dispInstance: DispatchedInstance = {
		dispatchedRemoteInstanceId: '1'//serviceHost().registerRemoteInstance(value),
	};

	return dispInstance;
}

export function makeOutboundArgs(args: any[]): any[] {
	return args.map(makeOutboundValue);
}

/**
 * Making  that will be passed into service instance method invocation.
 * Any remote instance info will be transformed by proxyFactory.
 */
export function makeInboundArgs(args: unknown[], proxyFactory: (instanceId: string) => unknown): unknown[] {
	return args.map(value => {
		if (isDispatchedInstance(value)) {
			return proxyFactory(value.dispatchedRemoteInstanceId);
		}

		if (isDispatchedCallback(value)) {
			return proxyFactory(value.callbackId);
		}

		return value;
	});
}
