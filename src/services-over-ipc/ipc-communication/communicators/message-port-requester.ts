import { MessagePortMain } from 'electron';
import { Disposable, HEADER_INVOKE_ID, Invocation } from './communicator-base';
import { IpcMessage, IpcResponse } from '../ipc-protocol';

export abstract class MessagePortRequester implements Disposable {
	private idGenerator = 1;
	private readonly invocations: Map<number, Invocation> = new Map();

    constructor(protected port: MessagePort | MessagePortMain){}

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

	protected responseHandler(msg: IpcResponse) {
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
