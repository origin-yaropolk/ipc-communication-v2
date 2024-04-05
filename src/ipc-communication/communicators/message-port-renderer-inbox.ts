import { MessagePortInbox } from './message-port-inbox';

export class MessagePortRendererInbox extends MessagePortInbox {
	constructor(port: MessagePort) {
        super(port);

        port.onmessage = ev => {
            this.messageHanlder(ev.data);
        };

        port.close = () => {
            this.closeHandler();
        };

        this.port.start();
	}
}
