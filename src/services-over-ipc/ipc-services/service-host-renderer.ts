import { IIpcInbox } from "../ipc-communication/ipc-inbox/base-ipc-inbox";
import { IpcCommunicator } from "../ipc-communication/communicators/ipc-communicator";
import { RemoteInstanceManager } from "./remote-instance-manager";
import { IpcProtocol, IpcRequest } from "../ipc-communication/ipc-protocol";
import { IpcHelper } from "../ipc-communication/ipc-core";

export class ServiceHostRenderer {

    constructor(private inbox: IIpcInbox, private communicator: IpcCommunicator, private instanceManager: RemoteInstanceManager) {
        this.initInboxing();
        this.performHandshake();
    }

    private initInboxing(): void {
        const requestHandlers: { [key: string]: (requet: IpcRequest) => void; } = {

        };

        this.inbox.onRequest.subscribe((request: IpcRequest) => {
			const messageType = IpcHelper.headerValue<string>(request, IpcProtocol.HEADER_MESSAGE_TYPE);
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