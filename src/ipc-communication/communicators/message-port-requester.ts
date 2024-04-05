import { IpcMessage, IpcResponse } from '../interfaces';
import { Disposable, HEADER_INVOKE_ID, Invocation } from './communicator-base';

export class MessagePortRendererRequester implements Disposable {
	private idGenerator = 0;
	private readonly invocations: Map<number, Invocation> = new Map();

	constructor(public port: MessagePort) {
		port.onmessage = ev => {                
			this.responseHandler(ev.data);
		}

		port.start();
	}

	request(msg: IpcMessage): Promise<IpcResponse> {
		return new Promise<IpcMessage>((resolve, reject) => {
			const msgId = ++this.idGenerator;
			msg.headers[HEADER_INVOKE_ID] = msgId;

			const responseTimeout = 500;

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

			this.port.postMessage(msg);
		});
	}

	private responseHandler(msg: IpcResponse) {
		const invokeId = this.getMyInvokeId(msg);
		const invocation = this.invocations.get(invokeId);

		if (invocation) {
			this.invocations.delete(invokeId);
			clearTimeout(invocation.invocationTimeout as number);
			invocation.resolve(msg);
		}
	}

	private getMyInvokeId(msg: IpcMessage): number {
		const invokeId = HEADER_INVOKE_ID in msg.headers ? msg.headers[HEADER_INVOKE_ID] : 0;

		return invokeId;
	}

	dispose(): void {
		this.port.close();
	}
}
