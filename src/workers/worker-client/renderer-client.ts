import { ipcRenderer } from "electron";
import { IpcCommunicator } from "../../ipc-communication/communicators/ipc-communicator";
import { RendererIpcInbox } from "../../ipc-communication/ipc-inbox/renderer-ipc-inbox";
import { IpcMessage, PortRendererResponse, REQUEST_CHANNEL } from "../../ipc-communication/interfaces";
import * as IpcP from '../../ipc-communication/ipc-protocol';
import { MY_SECOND_RENDERER_TEST_SERIVCE_CONTRACT } from "../../services/contracts";
import { MessagePortRendererRequester } from "../../ipc-communication/communicators/message-port-renderer-requester";
import { IpcProxy } from "../../ipc-communication/proxy/ipc-proxy";

function extractPort(body: unknown): MessagePort | undefined {
    return (body as PortRendererResponse).port;
}

async function startRenderer(): Promise<void> {
    const ipcCommunicator = new IpcCommunicator(new RendererIpcInbox(), (msg) => {
        ipcRenderer.send(REQUEST_CHANNEL, msg);
    });

    const body: IpcP.InstanceRequest = {
        contracts: [MY_SECOND_RENDERER_TEST_SERIVCE_CONTRACT],
    };
    
    const instanceRequest: IpcMessage = {
        headers: {
            [IpcP.HEADER_MESSAGE_TYPE]: IpcP.MESSAGE_GET_INSTANCE,
        },
        body,
    };
    
    const response = await ipcCommunicator.send(instanceRequest);
    const p = extractPort(response.body);

    if (p) {
        const c = new MessagePortRendererRequester(p);
        const service = IpcProxy.create<IMySecondRendererTestService>(c);


        const res = await service.mul(7, 7);
        const gre = await service.greet();

        console.log(res);
        console.log(gre);

        c.dispose();
    }
}

startRenderer();