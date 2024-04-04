import { app, BrowserWindow } from "electron";
import { MyTestService } from "./services/my-test-service";
import { MainIpcInbox } from "./ipc-communication/ipc-inbox/main-ipc-inbox";
import { RemoteInstanceManager } from "./ipc-communication/remote-instance-manager";


function startServices(...services: unknown[]): void {
}

function createWindow() {
    const mainWindow = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            // preload: path.resolve(app.getAppPath(), 'preload'),
            devTools: true,
            nodeIntegration: true,
            contextIsolation: false,
        },
    });

    mainWindow.webContents.openDevTools();
    mainWindow.loadFile("app/worker/index.html");
    
    startServices(MyTestService);
    const rim = new RemoteInstanceManager(new MainIpcInbox());
}

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
})

app.on('ready', () => {
    createWindow();
})
