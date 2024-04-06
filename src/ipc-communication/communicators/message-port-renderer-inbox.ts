import { MessagePortInbox } from './message-port-inbox';

export class MessagePortRendererInbox extends MessagePortInbox {
	constructor(port: MessagePort) {
        super(port);

        port.onmessage = ev => {
            this.messageHanlder(ev.data);
        };

        this.port.start();
	}
}
