import { MessagePortMain } from 'electron';

import { MessagePortInbox } from './message-port-inbox';

export class MessagePortMainInbox extends MessagePortInbox {
	constructor(port: MessagePortMain) {
        super(port);

        port.on('message', ev => {
            this.messageHanlder(ev.data);
        });

        port.on('close', () => {
            this.closeHandler();
        });

        this.port.start();
	}
}
