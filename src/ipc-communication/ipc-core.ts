
import { ipcMain } from 'electron';
import { IpcMessage, IpcRequest, PortResponse } from './interfaces.js';

export const isMainProcess = typeof ipcMain !== 'undefined';

export class IpcHelper {
	static hasHeader(message: IpcMessage, key: string, value?: unknown): boolean {
		if (!(key in message.headers)) {
			return false;
		}

		return typeof value === 'undefined' || message.headers[key] === value;
	}

	static headerValue<T>(message: IpcMessage, key: string): T | undefined {
		return key in message.headers ? message.headers[key] as T : undefined;
	}

	static response(request: IpcRequest, value: unknown): void {
		const response: IpcMessage = {
			headers: {
				...request.headers,
				success: true,
				failure: '',
			},
			body: value,
		};

		request.responseChannel(response);
	}

	static responseFailure(request: IpcRequest, error: string | any): void {
		let message = '';
		let stack: string | undefined;
		if (typeof error == 'string') {
			message = error;
		}
		else if (error instanceof Error) {
			message = `(${ error.name }):${ error.message }`;
			stack = error.stack;
		}
		else {
			message = 'Untyped error';
		}

		const response: IpcMessage = {
			headers: {
				...request.headers,
				success: false,
				failure: message,
			},
			body: {},
		};

		if (stack) {
			response.headers.stack = stack;
		}

		request.responseChannel(response);
	}

	static rethrowIfException(message: IpcMessage): void {
		if (!IpcHelper.hasHeader(message, 'success')) {
			throw new Error('Expected response message.');
		}

		if (message.headers.success) {
			return;
		}

		if ('failure' in message.headers && typeof message.headers.failure === 'string' && message.headers.failure !== '') {
			const error = new Error(message.headers.failure);
			if ('stack' in message.headers) {
				error.stack = message.headers.stack as string;
			}
			throw error;
		}

		throw new Error('Unspecified remoting error');
	}

	static getResponseBody<T = any>(message: IpcMessage): T {
		IpcHelper.rethrowIfException(message);
		return message.body as T;
	}

 /*
	static get requestContext(): unknown {
		return ipcRequestContext__;
	}*/
}

