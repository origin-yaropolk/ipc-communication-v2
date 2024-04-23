import { Event, ipcRenderer } from 'electron';

import { IpcChannels, IpcMessage, PortRendererResponse } from '../ipc-protocol';
import { BaseIpcInbox } from './base-ipc-inbox';

export class RendererIpcInbox extends BaseIpcInbox {
	onMessage(channel: string, handler: (ev: Event, msg: IpcMessage) => void): void {
		ipcRenderer.on(channel, handler);
	}

	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	makeResponseChannel(ev: Event): (msg: IpcMessage) => void {
		return function(msg: IpcMessage): void {
			const body = msg.body as PortRendererResponse;
			if (body.port) {
				msg.body = {};
				ipcRenderer.postMessage(IpcChannels.RESPONSE_CHANNEL, msg, [body.port]);
				return;
			}

			ipcRenderer.postMessage(IpcChannels.RESPONSE_CHANNEL, msg);
		};
	}
}
