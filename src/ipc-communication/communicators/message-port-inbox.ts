import { MessagePortMain } from 'electron';
import { Subject } from 'rxjs';

import { IpcMessage as IpcResponse, IpcRequest } from '../interfaces';
import { Disposable } from './communicator-base';

export class MessagePortInbox implements Disposable {
	private readonly onRequestSubject = new Subject<IpcRequest>();
	readonly onRequest = this.onRequestSubject.asObservable();

    private readonly onClosedSubject = new Subject<void>();
	readonly onClosed = this.onClosedSubject.asObservable();

	constructor(private port: MessagePortMain) {
        this.port.on('message', (messageEvent: Electron.MessageEvent) => {
            const responseChannel = this.makeResponseChannel(this.port);

            const request: IpcRequest = {
                ...messageEvent.data,
                responseChannel,
                context: messageEvent
            };

            this.onRequestSubject.next(request);
        });

        this.port.on('close', () => {
            this.onClosedSubject.next();
        });

        this.port.start();
	}

	private makeResponseChannel(port: MessagePortMain): (response: IpcResponse) => void {
        return function(response: IpcResponse): void {
            port.postMessage(response);
        };
    }

    dispose(): void {
        this.onRequestSubject.complete();
        this.port.close();
    }
}
