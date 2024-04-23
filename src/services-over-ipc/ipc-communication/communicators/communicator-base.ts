import { MessagePortMain } from 'electron';
import { Subject } from 'rxjs';

import { IpcHelper } from '../ipc-core';
import { IpcMessage, IpcProtocol, IpcRequest, IpcResponse } from '../ipc-protocol';
import { Communicator, CommunicatorProtocol, Invocation, MessageType, RequestMode } from './communicator';

export class CommunicatorBase implements Communicator {
	protected readonly onRequestSubject = new Subject<IpcRequest>();
	readonly onRequest = this.onRequestSubject.asObservable();

	protected readonly onClosedSubject = new Subject<void>();
	readonly onClosed = this.onClosedSubject.asObservable();

	private idGenerator = 1;
	private readonly invocations: Map<number, Invocation> = new Map();

	constructor(readonly id: number, readonly remoteId: number, protected readonly port: MessagePort | MessagePortMain) {}

	public request(msg: IpcMessage, mode: RequestMode = RequestMode.FireAndForget): Promise<IpcResponse> {
		return new Promise<IpcMessage>((resolve, reject) => {
			const msgId = ++this.idGenerator;
			msg.headers[CommunicatorProtocol.HEADER_INVOKE_ID] = msgId;
			msg.headers[IpcProtocol.HEADER_HOST_ID] = this.id;
			msg.headers[CommunicatorProtocol.HEADER_REQUEST_MODE] = mode;
			msg.headers[CommunicatorProtocol.HEADER_MESSAGE_TYPE] = MessageType.Request;

			if (mode === RequestMode.WaitForResponse) {
				const responseTimeout = 1000;

				const invocationTimeout = setTimeout(() => {
					const id = this.getMyInvokeId(msg);

					if (id && !this.invocations.has(id)) {
						return;
					}

					const errorMessage = `Timeout for invocation: ${ JSON.stringify(msg) }`;
					console.log(errorMessage);
				}, responseTimeout);

				this.invocations.set(msgId, {
					id: msgId,
					resolve,
					reject,
					invocationTimeout,
				});
			}

			this.port.postMessage(msg);
		});
	}

	protected responseHandler(msg: IpcResponse): void {
		const invokeId = this.getMyInvokeId(msg);
		const invocation = this.invocations.get(invokeId);

		if (invocation) {
			this.invocations.delete(invokeId);
			clearTimeout(invocation.invocationTimeout as number);
			invocation.resolve(msg);
		}
	}

	private getMyInvokeId(msg: IpcMessage): number {
		return IpcHelper.headerValue<number>(msg, CommunicatorProtocol.HEADER_INVOKE_ID) ?? 0;
	}

	protected messageHanlder(message: IpcMessage): void {
		const messageType = IpcHelper.headerValue<MessageType>(message, CommunicatorProtocol.HEADER_MESSAGE_TYPE);

		if (messageType === MessageType.Request) {
			const responseChannel = IpcHelper.hasHeader(message, CommunicatorProtocol.HEADER_REQUEST_MODE, RequestMode.WaitForResponse)
				? this.makeResponseChannel()
				// eslint-disable-next-line @typescript-eslint/no-unused-vars
				: (response: IpcResponse) => {};

			const request: IpcRequest = {
				...message,
				responseChannel,
			};

			this.onRequestSubject.next(request);
		}

		if (messageType === MessageType.Response) {
			this.responseHandler(message);
		}
	}

	protected closeHandler(): void {
		this.onClosedSubject.next();
	}

	protected makeResponseChannel(): (response: IpcResponse) => void {
		const port = this.port;
		return function(response: IpcResponse): void {
			response.headers[CommunicatorProtocol.HEADER_MESSAGE_TYPE] = MessageType.Response;
			port.postMessage(response);
		};
	}

	public dispose(): void {
		this.invocations.clear();
		this.onRequestSubject.complete();
		this.onClosedSubject.complete();
		this.port.close();
	}
}
