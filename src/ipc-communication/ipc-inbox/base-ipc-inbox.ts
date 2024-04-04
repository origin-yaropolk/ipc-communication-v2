import { Event, MessagePortMain } from 'electron';
import { Subject } from 'rxjs';

import { IIpcInbox, IpcMessage, IpcRequest, REQUEST_CHANNEL, RESPONSE_CHANNEL } from '../interfaces';

export let ipcRequestContext__: unknown;

export abstract class BaseIpcInbox implements IIpcInbox {
	private readonly onRequestSubject = new Subject<IpcRequest>();
	private readonly onResponseSubject = new Subject<IpcMessage>();

	readonly onRequest = this.onRequestSubject.asObservable();
	readonly onResponse = this.onResponseSubject.asObservable();

	constructor() {
		this.onMessage(REQUEST_CHANNEL, (ev: Event, msg: IpcMessage) => {
			const responseChannel = this.makeResponseChannel(ev);

			const request: IpcRequest = {
				...msg,
				responseChannel,
				context: ev,
			};

			try {
				ipcRequestContext__ = ev;
				this.onRequestSubject.next(request);
			}
			finally {
				ipcRequestContext__ = undefined;
			}
		});

		this.onMessage(RESPONSE_CHANNEL, (ev: Event, msg: IpcMessage) => {
			this.onResponseSubject.next(msg);
		});
	}

	protected abstract onMessage(channel: string, handler: (ev: Event, msg: IpcMessage) => void): void;
	protected abstract makeResponseChannel(ev: Event): (msg: IpcMessage, port?: MessagePort | MessagePortMain) => void;
}
