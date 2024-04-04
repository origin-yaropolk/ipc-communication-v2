import { MessagePortMain } from 'electron';

import { IpcMessage } from '../interfaces';
import { IpcHelper } from '../ipc-core';
import { Disposable, HEADER_COMMUNICATOR_ID, HEADER_INVOKE_ID, Invocation, getUID } from './communicator-base';

export class MessagePortCommunicator implements Disposable {
	private readonly id = getUID();
	private idGenerator = 0;
	private readonly invocations: Map<number, Invocation> = new Map();

	constructor(private port: MessagePort | MessagePortMain) {
        if (port instanceof MessagePort) {
            port.onmessage = ev => {                
                this.onMessageHandler(ev.data);
            }

			return;
        }

		port.on('message', ev => {
			this.onMessageHandler(ev.data);
		});
	}

	send(msg: IpcMessage): Promise<IpcMessage> {
		return new Promise<IpcMessage>((resolve, reject) => {
			const msgId = ++this.idGenerator;
			msg.headers[HEADER_INVOKE_ID] = msgId;
			msg.headers[HEADER_COMMUNICATOR_ID] = this.id;

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

	private onMessageHandler(msg: IpcMessage) {
		const id = this.getMyInvokeId(msg);

		if (!id) {
			return;
		}

		const invocation = this.invocations.get(id);

		if (invocation) {
			this.invocations.delete(id);
			clearTimeout(invocation.invocationTimeout as number);
			invocation.resolve(msg);
		}
	}

	private getMyInvokeId(msg: IpcMessage): number | null {
		if (!IpcHelper.hasHeader(msg, HEADER_COMMUNICATOR_ID, this.id)) {
			return null;
		}

		const id: unknown = HEADER_INVOKE_ID in msg.headers ? msg.headers[HEADER_INVOKE_ID] : null;
		if (typeof id !== 'number') {
			throw new Error(`[${ HEADER_INVOKE_ID }] expected to be a number`);
		}

		return id;
	}

	dispose(): void {
		this.port.close();
	}
}
