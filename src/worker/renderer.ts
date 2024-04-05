import { ipcRenderer } from "electron";
import { IpcCommunicator } from "../ipc-communication/communicators/ipc-communicator";
import { RendererIpcInbox } from "../ipc-communication/ipc-inbox/renderer-ipc-inbox";
import { IpcMessage, PortRendererResponse, REQUEST_CHANNEL } from "../ipc-communication/interfaces";
import * as IpcP from '../ipc-communication/ipc-protocol';
import { MY_TEST_SERVICE_CONTRACT } from "../services/contracts";
import { MessagePortRendererRequester } from "../ipc-communication/communicators/message-port-renderer-requester";
import { IpcHelper } from "../ipc-communication/ipc-core";
import { IpcProxy } from "../ipc-communication/proxy/ipc-proxy";
import { MyRendererTestService } from "../services/my-renderer-test-service";

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
        const service = IpcProxy.create<IMyTestService>(c);


        const res = await service.add(1, 2);
        const gre = await service.greet();

        console.log(res);
        console.log(gre);
    }
}

startRenderer();