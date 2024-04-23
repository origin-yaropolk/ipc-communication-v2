import { Subscription } from 'rxjs';

import { IpcHelper } from '../ipc-core';
import { IIpcInbox } from '../ipc-inbox/base-ipc-inbox';
import { IpcMessage } from '../ipc-protocol';
import { CommunicatorProtocol, getUID, Invocation } from './communicator';

export class IpcCommunicator {
	private readonly id = getUID();
	private readonly sender: (value: IpcMessage) => void;
	private idGenerator = 0;
	private readonly invocations: Map<number, Invocation> = new Map();
	private responseSubscription: Subscription;

	constructor(private inbox: IIpcInbox, sender: (value: IpcMessage) => void) {
		this.inbox = inbox;
		this.sender = sender;

		this.responseSubscription = this.inbox.onResponse.subscribe((msg: IpcMessage) => {
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
		});
	}

	send(msg: IpcMessage): Promise<IpcMessage> {
		return new Promise<IpcMessage>((resolve, reject) => {
			const msgId = ++this.idGenerator;
			msg.headers[CommunicatorProtocol.HEADER_INVOKE_ID] = msgId;
			msg.headers[CommunicatorProtocol.HEADER_COMMUNICATOR_ID] = this.id;

			const responseTimeout = 1500;

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

			this.sender(msg);
		});
	}

	private getMyInvokeId(msg: IpcMessage): number | null {
		if (!IpcHelper.hasHeader(msg, CommunicatorProtocol.HEADER_COMMUNICATOR_ID, this.id)) {
			return null;
		}

		const id: unknown = CommunicatorProtocol.HEADER_INVOKE_ID in msg.headers ? msg.headers[CommunicatorProtocol.HEADER_INVOKE_ID] : null;
		if (typeof id !== 'number') {
			throw new Error(`[${ CommunicatorProtocol.HEADER_INVOKE_ID }] expected to be a number`);
		}

		return id;
	}

	dispose(): void {
		this.responseSubscription.unsubscribe();
	}
}
