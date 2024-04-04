import { Event, ipcMain, IpcMainEvent, MessagePortMain } from 'electron';

import { IpcMessage, RESPONSE_CHANNEL } from '../interfaces';
import { BaseIpcInbox } from './base-ipc-inbox';

export class MainIpcInbox extends BaseIpcInbox {
	onMessage(channel: string, handler: (ev: Event, msg: IpcMessage) => void): void {
		ipcMain.on(channel, handler);
	}

	makeResponseChannel(ev: Event): (msg: IpcMessage, port?: MessagePort | MessagePortMain) => void {
		return function(msg: IpcMessage, port?: MessagePort | MessagePortMain): void {
			const sender = (ev as IpcMainEvent).sender;
			if (!sender.isDestroyed()) {
				if (port && !(port instanceof MessagePort)) {
					sender.postMessage(RESPONSE_CHANNEL, msg, [port]);
				}
			}
			else {
				console.debug('Response will not be send to the destroyed contents');
			}
		};
	}
}