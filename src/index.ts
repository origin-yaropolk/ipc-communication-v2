import { app, BrowserWindow } from "electron";
import { MyTestService } from "./services/my-test-service";

import { MainIpcInbox, RemoteInstanceManager, RemoteServiceProvider, ServiceHost } from "./services-over-ipc/main";

import { MY_SECOND_RENDERER_TEST_SERIVCE_CONTRACT } from "./services/contracts";

function startServices(...services: unknown[]): void {
}

async function startApp(): Promise<void> {
    startServices(MyTestService);

    const mainInbox = new MainIpcInbox();
    const instanceManager = new RemoteInstanceManager(mainInbox);
    const serviceHost = new ServiceHost(mainInbox, instanceManager);

    setTimeout(() => { createWindow("app/worker-first/index.html") }, 3000);
    createWindow("app/worker-second/index.html");

    setTimeout(async () => {
        const secondTestService = RemoteServiceProvider.instance.provide<IMySecondRendererTestService>(serviceHost, [MY_SECOND_RENDERER_TEST_SERIVCE_CONTRACT]);

        console.log(await secondTestService.greet());
        console.log(await secondTestService.mul(6, 10));
    }, 3000);
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

