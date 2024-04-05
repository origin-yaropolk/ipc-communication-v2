import { Event, MessagePortMain, ipcRenderer } from 'electron';

import { IpcMessage, RESPONSE_CHANNEL } from '../interfaces';
import { BaseIpcInbox } from './base-ipc-inbox';

export class RendererIpcInbox extends BaseIpcInbox {
	onMessage(channel: string, handler: (ev: Event, msg: IpcMessage) => void): void {
		ipcRenderer.on(channel, handler);
	}

    makeResponseChannel(ev: Event): (msg: IpcMessage) => void {
		return function(msg: IpcMessage): void {
			ipcRenderer.send(RESPONSE_CHANNEL, msg);
		};
	}
}

