import { ipcRenderer } from "electron";
import { IpcCommunicator } from "../ipc-communication/communicators/ipc-communicator";
import { RendererIpcInbox } from "../ipc-communication/ipc-inbox/renderer-ipc-inbox";
import { IpcMessage, PortRendererResponse, REQUEST_CHANNEL } from "../ipc-communication/interfaces";
import * as IpcP from '../ipc-communication/ipc-protocol';
import { MY_TEST_SERVICE_CONTRACT } from "../services/contracts";
import { MessagePortRendererRequester } from "../ipc-communication/communicators/message-port-requester";
import { IpcHelper } from "../ipc-communication/ipc-core";

async function remoteInvoke__<T = unknown>(communicator: MessagePortRendererRequester, instanceId: string, method: string, messageType: string, args: any[]): Promise<T> {
	const body: IpcP.InvokeRequest = {
		instanceId,
		method,
		args: IpcP.makeOutboundArgs(args),
	};

	const response = await communicator.request({
		headers: {
			[IpcP.HEADER_MESSAGE_TYPE]: messageType,
		},
		body,
	});

	return IpcHelper.getResponseBody<T>(response);
}

function extractPort(body: unknown): MessagePort | undefined {
    return (body as PortRendererResponse).port;
}

async function startRenderer(): Promise<void> {
    const ipcCommunicator = new IpcCommunicator(new RendererIpcInbox(), (msg) => {
        ipcRenderer.send(REQUEST_CHANNEL, msg);
    });

    const body: IpcP.GetInstanceRequest = {
        contracts: [MY_TEST_SERVICE_CONTRACT],
    };
    
    const instanceRequest: IpcMessage = {
        headers: {
            [IpcP.HEADER_MESSAGE_TYPE]: IpcP.MESSAGE_GETINSTANCE,
        },
        body,
    };
    


    const hui = await ipcCommunicator.send(instanceRequest);
    const p = extractPort(hui.body);

    if (p) {
        const c = new MessagePortRendererRequester(p);
        const res = await remoteInvoke__(c, '0', 'add', IpcP.MESSAGE_INVOKE, [1, 2]);
        console.log(res);
    }
}

startRenderer();