import { Observable } from 'rxjs';

export const REQUEST_CHANNEL = 'tvd-ipc:request';
export const RESPONSE_CHANNEL = 'tvd-ipc:response';

export interface IpcMessage {
	headers: { [key: string]: any; };
	body: unknown;
}

export interface IpcRequest extends IpcMessage {
	responseChannel(value: IpcMessage): void;
	context: unknown;
}

export interface IIpcInbox {
	readonly onRequest: Observable<IpcRequest>;
	readonly onResponse: Observable<IpcMessage>;
}