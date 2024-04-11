import { MessagePortRequester } from './message-port-requester';

export class MessagePortRendererRequester extends MessagePortRequester {
	constructor(port: MessagePort, selfHostId: number) {
		super(port, selfHostId);

        port.addEventListener('message', (ev) => {
            this.responseHandler(ev.data);
        });

		this.port.start();
	}
}
