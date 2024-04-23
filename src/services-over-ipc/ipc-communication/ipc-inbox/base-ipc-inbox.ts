import { Event, IpcRendererEvent } from 'electron';
import { Observable, Subject } from 'rxjs';

import { IpcChannels, IpcMessage, IpcProtocol, IpcRequest } from '../ipc-protocol';

interface WithSenderId extends Event {
	sender: {
		id: number;
	};
}

interface WithPort extends Event {
	ports: MessagePort[];
}

function eventHasSenderId(ev: Event): ev is WithSenderId {
	return (ev as unknown as WithSenderId).sender.id !== undefined;
}

function eventHasPort(ev: Event): ev is WithPort {
	return (ev as unknown as WithPort).ports !== undefined;
}

export interface IIpcInbox {
	readonly onRequest: Observable<IpcRequest>;
	readonly onResponse: Observable<IpcMessage>;
}

export abstract class BaseIpcInbox implements IIpcInbox {
	private readonly onRequestSubject = new Subject<IpcRequest>();
	private readonly onResponseSubject = new Subject<IpcMessage>();

	readonly onRequest = this.onRequestSubject.asObservable();
	readonly onResponse = this.onResponseSubject.asObservable();

	constructor() {
		this.onMessage(IpcChannels.REQUEST_CHANNEL, (ev: Event, msg: IpcMessage) => {
			const responseChannel = this.makeResponseChannel(ev);

			if (eventHasSenderId(ev)) {
				msg.headers[IpcProtocol.HEADER_HOST_ID] = ev.sender.id;
			}

			const request: IpcRequest = {
				...msg,
				responseChannel,
				port: eventHasPort(ev) ? ev.ports[0] : undefined,
			};

			this.onRequestSubject.next(request);
		});

		this.onMessage(IpcChannels.RESPONSE_CHANNEL, (ev: Event, msg: IpcMessage) => {
			const [port] = (ev as IpcRendererEvent).ports;

			if (port) {
				msg.body = { port };
			}

			this.onResponseSubject.next(msg);
		});
	}

	protected abstract onMessage(channel: string, handler: (ev: Event, msg: IpcMessage) => void): void;
	protected abstract makeResponseChannel(ev: Event): (msg: IpcMessage) => void;
}
