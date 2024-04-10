import { MessagePortInbox } from './message-port-inbox';

export class MessagePortRendererInbox extends MessagePortInbox {
	constructor(port: MessagePort) {
        super(port);

        port.addEventListener('message', (ev) => {
            this.messageHanlder(ev.data);
        });

        this.port.start();
	}
}
