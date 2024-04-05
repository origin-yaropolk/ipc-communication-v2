import { Event, MessagePortMain, ipcRenderer } from 'electron';

import { IpcMessage, PortRendererResponse, RESPONSE_CHANNEL } from '../interfaces';
import { BaseIpcInbox } from './base-ipc-inbox';

export class RendererIpcInbox extends BaseIpcInbox {
	onMessage(channel: string, handler: (ev: Event, msg: IpcMessage) => void): void {
		ipcRenderer.on(channel, handler);
	}

    makeResponseChannel(ev: Event): (msg: IpcMessage) => void {
		return function(msg: IpcMessage): void {
			const body = msg.body as PortRendererResponse;
			if (body.port) {
				msg.body = {};
				ipcRenderer.postMessage(RESPONSE_CHANNEL, msg, [body.port]);
				return;
			}

			ipcRenderer.postMessage(RESPONSE_CHANNEL, msg);
		};
	}
}

