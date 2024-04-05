import { MessagePortMain } from 'electron';
import { Subject } from 'rxjs';

import { IpcMessage as IpcResponse, IpcRequest, IpcMessage } from '../interfaces';
import { Disposable } from './communicator-base';

export abstract class MessagePortInbox implements Disposable {
	protected readonly onRequestSubject = new Subject<IpcRequest>();
	readonly onRequest = this.onRequestSubject.asObservable();

    protected readonly onClosedSubject = new Subject<void>();
	readonly onClosed = this.onClosedSubject.asObservable();

	constructor(protected port: MessagePort | MessagePortMain) {}

    protected messageHanlder(message: IpcMessage): void {
        const responseChannel = this.makeResponseChannel(this.port);

        const request: IpcRequest = {
            ...message,
            responseChannel
        };

        this.onRequestSubject.next(request);
    }

    protected closeHandler(): void {
        this.onClosedSubject.next();
    }

	protected makeResponseChannel(port: MessagePort | MessagePortMain): (response: IpcResponse) => void {
        return function(response: IpcResponse): void {
            port.postMessage(response);
        };
    }

    dispose(): void {
        this.onRequestSubject.complete();
        this.port.close();
    }
}
