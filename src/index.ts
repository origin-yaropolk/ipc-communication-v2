import { app, BrowserWindow, MessagePortMain } from "electron";
import { MyTestService } from "./services/my-test-service";
import { MainIpcInbox } from "./ipc-communication/ipc-inbox/main-ipc-inbox";
import { RemoteInstanceManager } from "./ipc-communication/remote-instance-manager";
import { IpcCommunicator } from "./ipc-communication/communicators/ipc-communicator";
import { IpcMessage, PortResponse, REQUEST_CHANNEL } from "./ipc-communication/interfaces";
import { MY_RENDERER_TEST_SERVICE_CONTRACT } from "./services/contracts";
import * as IpcP from './ipc-communication/ipc-protocol';
import { MessagePortMainRequester } from "./ipc-communication/communicators/message-port-main-requester";
import { IpcProxy } from "./ipc-communication/proxy/ipc-proxy";
import { getMessageChannelConstructor } from "./ipc-communication/message-channel-constructor";
import { ServiceHost } from "./ipc-services/service-host";

function startServices(...services: unknown[]): void {
}

function extractPort(body: unknown): MessagePortMain | undefined {
    return (body as PortResponse).port;
}

async function requestRemoteSerivce(): Promise<void> {
    const body: IpcP.InstanceRequest = {
        contracts: [MY_RENDERER_TEST_SERVICE_CONTRACT],
    };
    
    const instanceRequest: IpcMessage = {
        headers: {
            [IpcP.HEADER_MESSAGE_TYPE]: IpcP.MESSAGE_GET_INSTANCE,
        },
        body,
    };

    //const ipcCommunicator = new IpcCommunicator(new MainIpcInbox(), (msg) => {
    //    wnd.webContents.send(REQUEST_CHANNEL, msg);
    //});
/*
    const p = extractPort((await ipcCommunicator.send(instanceRequest)).body);
    if (p) {
        const c = new MessagePortMainRequester(p);
        const service = IpcProxy.create<IMyRendererTestService>(c);

        const res1 = await service.sub(10, 2);
        const res2 = await service.greet();

        console.log(res1);
        console.log(res2);
    }*/
}

function startApp(): void {
    startServices(MyTestService);

    const mainInbox = new MainIpcInbox();
    const serviceHost = new ServiceHost(mainInbox);
    const rim = new RemoteInstanceManager(new MainIpcInbox());


    setTimeout(() => { createWindow("app/worker-first/index.html") }, 3000);
    //createWindow("app/worker-second/index.html");

    //setTimeout(() => { createWindow("app/worker-client/index.html") }, 3000);
}

function createWindow(filePath: string) {
    const mainWindow = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            devTools: true,
            nodeIntegration: true,
            contextIsolation: false,
        },
    });

    mainWindow.webContents.openDevTools();
    mainWindow.loadFile(filePath);
}

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
})

app.on('ready', () => {
    startApp();
})
