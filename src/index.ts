import { app, BrowserView, BrowserWindow, WebContentsView } from "electron";
import { MyTestService } from "./services/my-test-service";

import { MY_RENDERER_TEST_SERVICE_CONTRACT, MY_SECOND_RENDERER_TEST_SERIVCE_CONTRACT, MY_TEST_SERVICE_CONTRACT } from "./services/contracts";
import { ServiceLocatorOverIpc } from "./services-over-ipc";
import { IMyRendererTestService, IMySecondRendererTestService, IMyTestService } from "./services/interfaces";


function startServices(...services: unknown[]): void {
}

async function startApp(): Promise<void> {
    ServiceLocatorOverIpc.initialize();
    
    //startServices(MyTestService);

    const id1 = createWindow("app/worker-first/index.html");
    const id2 =createWindow("app/worker-second/index.html");

    setTimeout(async () => {
        const serv1 = ServiceLocatorOverIpc.provider().provideProxy<IMyRendererTestService>([MY_RENDERER_TEST_SERVICE_CONTRACT], id1);
        const serv2 = ServiceLocatorOverIpc.provider().provideProxy<IMyRendererTestService>([MY_RENDERER_TEST_SERVICE_CONTRACT], id2);

        console.log(await serv1.greet());
        console.log(await serv2.greet());

    }, 2000);
    
    //setTimeout(() => { createWindow("app/worker-client/index.html") }, 3000);
}

function createWindow(filePath: string): number {
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

    return mainWindow.webContents.id;
}

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
})

app.on('ready', () => {
    setTimeout(async () => {
        startApp();
    }, 1000);
})

