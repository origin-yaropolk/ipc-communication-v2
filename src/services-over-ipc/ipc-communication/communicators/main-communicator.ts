import { MessagePortMain } from 'electron';

import { IpcMessage } from '../ipc-protocol';
import { CommunicatorBase } from './communicator-base';

export class MainCommunicator extends CommunicatorBase {
	constructor(id: number, remoteId: number, port: MessagePortMain) {
		super(id, remoteId, port);

		port.on('message', (ev: Electron.MessageEvent) => {
			this.messageHanlder(ev.data as IpcMessage);
		});

		port.on('close', () => {
			this.closeHandler();
		});

		this.port.start();
	}
}
