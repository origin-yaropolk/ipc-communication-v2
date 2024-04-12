import { MessagePortMain } from 'electron';
import { CommunicatorBase } from './communicator-base';

export class MainCommunicator extends CommunicatorBase {
	constructor(id: number, remoteId: number, port: MessagePortMain) {
        super(id, remoteId, port);

        port.on('message', ev => {
            this.messageHanlder(ev.data);
        });

        port.on('close', () => {
            this.closeHandler();
        });

        this.port.start();
	}
}
