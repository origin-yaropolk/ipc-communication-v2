import { CommunicatorBase } from './communicator-base';

export class RendererCommunicator extends CommunicatorBase {
	constructor(id: number, remoteId: number, port: MessagePort) {
        super(id, remoteId, port);

        port.addEventListener('message', (ev) => {
            this.messageHanlder(ev.data);
        });

		this.port.start();
	}
}
