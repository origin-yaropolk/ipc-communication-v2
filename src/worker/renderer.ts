import { ipcRenderer } from "electron";
import { IpcCommunicator } from "../ipc-communication/communicators/ipc-communicator";
import { RendererIpcInbox } from "../ipc-communication/ipc-inbox/renderer-ipc-inbox";
import { IpcMessage, REQUEST_CHANNEL } from "../ipc-communication/interfaces";
import * as IpcP from '../ipc-communication/ipc-protocol';
import { MY_TEST_SERVICE_CONTRACT } from "../services/contracts";

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
    console.log(JSON.stringify(hui.headers));
    console.log(JSON.stringify(hui.body));
}

startRenderer();