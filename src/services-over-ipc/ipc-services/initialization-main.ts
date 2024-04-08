
import { MainIpcInbox } from "../ipc-communication/ipc-inbox/main-ipc-inbox";
import { ServiceHost } from "./service-host";

export abstract class ServiceLocatorOverIpc {
    private static host: ServiceHost | null = null;

    public static initialize(): void {
        if (!ServiceLocatorOverIpc.host) {
            ServiceLocatorOverIpc.host = new ServiceHost(new MainIpcInbox());
        }

        console.warn('ServiceLocatorOverIpc: ServiceHost in main proccess already initialized');
    }
}