import { IpcMessage } from '../ipc-protocol';
import { CommunicatorBase } from './communicator-base';

export class RendererCommunicator extends CommunicatorBase {
	constructor(id: number, remoteId: number, port: MessagePort) {
		super(id, remoteId, port);

		port.addEventListener('message', (ev: MessageEvent<unknown>) => {
			this.messageHanlder(ev.data as IpcMessage);
		});

		this.port.start();
	}
}
