import { RendererCommunicator } from "../ipc-communication/communicators/renderer-communicator";
import { IpcHelper } from "../ipc-communication/ipc-core";
import { IIpcInbox } from "../ipc-communication/ipc-inbox/base-ipc-inbox";
import { IpcProtocol, IpcRequest, PortRequest } from "../ipc-communication/ipc-protocol";
import { RemoteInstanceManager } from "./remote-instance-manager";
import { ServiceProvider } from "./service-provider";

export class ServiceHostRenderer {
	private readonly serviceProvider;
	private readonly instanceManager;

    constructor(private inbox: IIpcInbox) {
        this.initInboxing();

		this.serviceProvider = new ServiceProvider(this.inbox);
		this.instanceManager = new RemoteInstanceManager(this.serviceProvider);
    }

    get provider(): ServiceProvider {
        return this.serviceProvider;
    }

    private initInboxing(): void {
        const requestHandlers: { [key: string]: (requet: IpcRequest) => void; } = {
            [IpcProtocol.MESSAGE_PORT_REQUEST]: (request: IpcRequest) => {
                const data = request.body as PortRequest;
				const port = request.port;

				if (!port) {
					return IpcHelper.responseFailure(request, `Request does not contains port`);
				}

				const instance = this.instanceManager.tryGetInstance(data.contracts);

				if (!instance) {
					return IpcHelper.responseFailure(request, `No service provider found for contracts [${data.contracts[0]}]`);
				}

				instance.addCommunicator(new RendererCommunicator(data.id, data.remoteId, port));

				IpcHelper.response(request, 'Port successfully added');
            }
        };

        this.inbox.onRequest.subscribe((request: IpcRequest) => {
			const messageType = IpcHelper.headerValue<string>(request, IpcProtocol.HEADER_REQUEST_TYPE);
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
}