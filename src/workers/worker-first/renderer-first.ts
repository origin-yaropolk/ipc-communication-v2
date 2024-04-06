import { ipcRenderer } from "electron";
import { IpcCommunicator } from "../../ipc-communication/communicators/ipc-communicator";
import { RendererIpcInbox } from "../../ipc-communication/ipc-inbox/renderer-ipc-inbox";
import { IpcMessage, PortRendererResponse, REQUEST_CHANNEL } from "../../ipc-communication/interfaces";
import * as IpcP from '../../ipc-communication/ipc-protocol';
import { MY_TEST_SERVICE_CONTRACT } from "../../services/contracts";
import { MessagePortRendererRequester } from "../../ipc-communication/communicators/message-port-renderer-requester";
import { IpcHelper } from "../../ipc-communication/ipc-core";
import { IpcProxy, Promisify } from "../../ipc-communication/proxy/ipc-proxy";
import { MyRendererTestService } from "../../services/my-renderer-test-service";
import { RemoteInstanceManager } from "../../ipc-services/remote-instance-manager";
import { getMessageChannelConstructor } from "../../ipc-communication/message-channel-constructor";

function extractPort(body: unknown): MessagePort | undefined {
    return (body as PortRendererResponse).port;
}

function startServices(...services: unknown[]): void {}

let serv: Promisify<IMyTestService> | undefined;

const ipcCommunicator = new IpcCommunicator(new RendererIpcInbox(), (msg) => {
    ipcRenderer.send(REQUEST_CHANNEL, msg);
});

async function getService(): Promise<Promisify<IMyTestService>> {
    if (!serv) {
        const body: IpcP.InstanceRequest = {
            contracts: [MY_TEST_SERVICE_CONTRACT],
        };
        
        const instanceRequest: IpcMessage = {
            headers: {
                [IpcP.HEADER_MESSAGE_TYPE]: IpcP.MESSAGE_GET_INSTANCE,
            },
            body,
        };
        
        const hui = await ipcCommunicator.send(instanceRequest);
        const p = extractPort(hui.body);

        if (!p) {
            throw new Error('Not port recieved');
        }

        const c = new MessagePortRendererRequester(p);
        const service = IpcProxy.create<IMyTestService>(c);

        const res = await service.add(1, 2);
        const gre = await service.greet();

        console.log(res);
        console.log(gre);

        serv = service;
    }

    return serv;
}

async function startRenderer(): Promise<void> {
    // startServices(MyRendererTestService);

    const rim = new RemoteInstanceManager(new RendererIpcInbox());

    const s = await getService();
}

startRenderer();