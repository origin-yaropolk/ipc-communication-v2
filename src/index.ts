import { app, BrowserWindow } from "electron";
import { MyTestService } from "./services/my-test-service";

import { MY_RENDERER_TEST_SERVICE_CONTRACT, MY_SECOND_RENDERER_TEST_SERIVCE_CONTRACT, MY_TEST_SERVICE_CONTRACT } from "./services/contracts";
import { ServiceLocatorOverIpc } from "./services-over-ipc";
import { IMyRendererTestService, IMySecondRendererTestService, IMyTestService } from "./services/interfaces";


function startServices(...services: unknown[]): void {
}

async function startApp(): Promise<void> {
    ServiceLocatorOverIpc.initialize();
    
    startServices(MyTestService);

    createWindow("app/worker-first/index.html");
    createWindow("app/worker-second/index.html");

    setTimeout(async () => {
        const serv1 = ServiceLocatorOverIpc.provider().provide<IMyTestService>([MY_TEST_SERVICE_CONTRACT]);
        const serv2 = await ServiceLocatorOverIpc.provider().provideProxy<IMySecondRendererTestService>([MY_SECOND_RENDERER_TEST_SERIVCE_CONTRACT]);
        const serv3 = await ServiceLocatorOverIpc.provider().provideProxy<IMyRendererTestService>([MY_RENDERER_TEST_SERVICE_CONTRACT]);

        console.log(serv1.greet());
        console.log(serv1.add(6, 10));

        console.log(await serv2.greet());
        console.log(await serv2.mul(6, 10));

        serv3.statusChanged.subscribe((value: number) => {
            console.log(value);
        });

        serv3.changeStatus(228);
    }, 2000);
    
    setTimeout(() => { createWindow("app/worker-client/index.html") }, 3000);
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
    setTimeout(async () => {
        startApp();
    }, 1000);
})

