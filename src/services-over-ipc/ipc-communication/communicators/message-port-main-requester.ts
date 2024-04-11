import { MessagePortMain } from 'electron';
import { MessagePortRequester } from './message-port-requester';

export class MessagePortMainRequester extends MessagePortRequester {
	constructor(port: MessagePortMain, selfHostId: number) {
        super(port, selfHostId);

		port.on('message', ev => {
            this.responseHandler(ev.data);
        });

		this.port.start();
	}
}
