import { MessageChannelMain, webContents } from "electron";
import { IIpcInbox, IpcMessage, IpcRequest, REQUEST_CHANNEL } from "../ipc-communication/interfaces";
import * as IpcP from '../ipc-communication/ipc-protocol';
import { IpcHelper } from "../ipc-communication/ipc-core";
import { RemoteInstanceManager } from "./remote-instance-manager";
import { IpcCommunicator } from "../ipc-communication/communicators/ipc-communicator";

export class ServiceHostRenderer {

    constructor(private inbox: IIpcInbox, private communicator: IpcCommunicator, private instanceManager: RemoteInstanceManager) {
        this.initInboxing();
        this.performHandshake();
    }

    private initInboxing(): void {
        const requestHandlers: { [key: string]: (requet: IpcRequest) => void; } = {

        };

        this.inbox.onRequest.subscribe((request: IpcRequest) => {
			const messageType = IpcHelper.headerValue<string>(request, IpcP.HEADER_MESSAGE_TYPE);
			try {
				if (messageType && messageType in requestHandlers) {
					requestHandlers[messageType](request);
				}
			}
			catch (error) {
				IpcHelper.responseFailure(request, error);
			}
		});
    }

    private performHandshake(): void {

    }
}