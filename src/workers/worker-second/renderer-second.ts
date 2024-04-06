import { ipcRenderer } from "electron";
import { IpcCommunicator } from "../../ipc-communication/communicators/ipc-communicator";
import { RendererIpcInbox } from "../../ipc-communication/ipc-inbox/renderer-ipc-inbox";
import { IpcMessage, PortRendererResponse, REQUEST_CHANNEL } from "../../ipc-communication/interfaces";
import * as IpcP from '../../ipc-communication/ipc-protocol';
import { MY_TEST_SERVICE_CONTRACT } from "../../services/contracts";
import { MessagePortRendererRequester } from "../../ipc-communication/communicators/message-port-renderer-requester";
import { IpcHelper } from "../../ipc-communication/ipc-core";
import { IpcProxy } from "../../ipc-communication/proxy/ipc-proxy";
import { RemoteInstanceManager } from "../../ipc-communication/remote-instance-manager";
import { getMessageChannelConstructor } from "../../ipc-communication/message-channel-constructor";
import { MySecondRendererTestService } from "../../services/my-second-renderer-test-service";

function startServices(...services: unknown[]): void {}

async function startRenderer(): Promise<void> {
    startServices(MySecondRendererTestService);

    const rim = new RemoteInstanceManager(new RendererIpcInbox());
}

startRenderer();