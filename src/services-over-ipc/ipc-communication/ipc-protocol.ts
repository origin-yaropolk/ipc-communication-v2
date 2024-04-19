import { MessagePortMain, ipcMain } from 'electron';


const isMainProcess = typeof ipcMain !== 'undefined';

export interface InstanceBaseRequest {
}

export interface IpcMessage {
	headers: { [key: string]: any; };
	body: unknown;
}

export type IpcResponse = IpcMessage;

export interface IpcRequest extends IpcMessage {
	responseChannel(value: IpcMessage): void;
	port?: MessagePort;
}

export interface PortResponse {
	port: MessagePortMain
}

export interface PortRendererResponse {
	port: MessagePort
}

export interface InvokeRequest extends InstanceBaseRequest {
	method: string;
	args: unknown[];
}

export type DisposeRequest = InstanceBaseRequest;

export interface InstanceRequest {
	contracts: string[];
	specificHostId?: number;
}

export interface RegisterInstanceRequest {
    contracts: string[];
}

export type UnregisterInstanceRequest = RegisterInstanceRequest;

export interface PortRequest extends RegisterInstanceRequest {
	id: number;
	remoteId: number;
}

export interface HostDeadNotificationRequest {
	id: number;
}

export type GetInstanceResponse = InstanceBaseRequest;

export interface DispatchedInstance {
	dispatchedRemoteInstanceId: string;
}

export interface DispatchedCallback {
	callbackId: string;
}

export enum IpcProtocol {
	HEADER_REQUEST_TYPE = 'request-type',
	HEADER_HOST_ID = 'host-id',
	HEADER_REQUEST_MODE = 'request-mode',

	MESSAGE_REGISTER_INSTANCE = 'host:register-instance',
	MESSAGE_UNREGISTER_INSTANCE = 'host:unregister-instance',
	MESSAGE_GET_INSTANCE = 'host:get-instance',
	MESSAGE_PORT_REQUEST = 'host:port-request',
	MESSAGE_HOST_DEAD_NOTIFICATION = 'host:host-dead-notification',

	MESSAGE_INVOKE = 'instance:invoke',
	MESSAGE_DISPOSE = 'instance:dispose',

	MESSAGE_EVENT_SUBSCRIBE = 'instance:event_subscribe',
	MESSAGE_EVENT_UNSUBSCRIBE = 'instance:event_unsubscribe',
	MESSAGE_EVENT_EMIT = 'instance:event_emit',
}

export enum IpcChannels {
	REQUEST_CHANNEL = 'ipc-services:request',
	RESPONSE_CHANNEL = 'ipc-services:response'
}

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

export function makeInboundArgs(args: unknown[]): unknown[] {
	return args.map(value => {
		return value;
	});
}
