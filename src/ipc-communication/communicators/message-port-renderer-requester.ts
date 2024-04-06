import { MessagePortRequester } from './message-port-requester';

export class MessagePortRendererRequester extends MessagePortRequester {
	constructor(port: MessagePort) {
		super(port);

		port.onmessage = ev => {                
			this.responseHandler(ev.data);
		}

		this.port.start();
	}
}
