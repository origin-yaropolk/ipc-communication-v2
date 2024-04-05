import { Event, IpcRendererEvent } from 'electron';
import { Subject } from 'rxjs';

import { IIpcInbox, IpcMessage, IpcRequest, REQUEST_CHANNEL, RESPONSE_CHANNEL } from '../interfaces';

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
			};

			this.onRequestSubject.next(request);
		});

		this.onMessage(RESPONSE_CHANNEL, (ev: Event, msg: IpcMessage) => {
			const [port] = (ev as IpcRendererEvent).ports

			if (port) {
				msg.body = { port: port };
			}

			this.onResponseSubject.next(msg);
		});
	}

	protected abstract onMessage(channel: string, handler: (ev: Event, msg: IpcMessage) => void): void;
	protected abstract makeResponseChannel(ev: Event): (msg: IpcMessage) => void;
}
