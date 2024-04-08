import { app, BrowserWindow } from "electron";
import { MyTestService } from "./services/my-test-service";

import { MY_SECOND_RENDERER_TEST_SERIVCE_CONTRACT } from "./services/contracts";
import { ServiceLocatorOverIpc } from "./services-over-ipc/main";

import { RemoteServiceProvider } from "./services-over-ipc/ipc-services/service-provider";

function startServices(...services: unknown[]): void {
}

async function startApp(): Promise<void> {
    ServiceLocatorOverIpc.initialize();
    
    startServices(MyTestService);

    setTimeout(() => { createWindow("app/worker-first/index.html") }, 3000);
    createWindow("app/worker-second/index.html");

    setTimeout(async () => {
        const secondTestService = RemoteServiceProvider.instance.provide<IMySecondRendererTestService>([MY_SECOND_RENDERER_TEST_SERIVCE_CONTRACT]);

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

