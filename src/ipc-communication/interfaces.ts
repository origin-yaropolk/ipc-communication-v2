import { MessagePortMain } from 'electron';
import { Observable } from 'rxjs';

export const REQUEST_CHANNEL = 'tvd-ipc:request';
export const RESPONSE_CHANNEL = 'tvd-ipc:response';

export interface IpcMessage {
	headers: { [key: string]: any; };
	body: unknown;
}

export type IpcResponse = IpcMessage;

export interface IpcRequest extends IpcMessage {
	responseChannel(value: IpcMessage): void;
	context: unknown;
}

export interface PortResponse {
	port: MessagePortMain
}

export interface PortRendererResponse {
	port: MessagePort
}

export interface IIpcInbox {
	readonly onRequest: Observable<IpcRequest>;
	readonly onResponse: Observable<IpcMessage>;
}