import { MessagePortMain } from 'electron';
import { MessagePortRequester } from './message-port-requester';

export class MessagePortMainRequester extends MessagePortRequester {
	constructor(port: MessagePortMain) {
        super(port);

		port.on('message', ev => {
            this.responseHandler(ev.data);
        });

		port.start();
	}
}
