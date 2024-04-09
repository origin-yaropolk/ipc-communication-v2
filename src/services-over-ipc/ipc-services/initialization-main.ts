
import { MainIpcInbox } from "../ipc-communication/ipc-inbox/main-ipc-inbox";
import { ServiceHost } from "./service-host";
import { ServiceProvider } from "./service-provider";

export abstract class ServiceLocatorOverIpc {
    private static host: ServiceHost | null = null;

    public static initialize(): void {
        if (!ServiceLocatorOverIpc.host) {
            ServiceLocatorOverIpc.host = new ServiceHost(new MainIpcInbox());
            return;
        }

        console.warn('ServiceLocatorOverIpc: ServiceHost in main proccess already initialized');
    }

    public static provider(): ServiceProvider {
        if (!ServiceLocatorOverIpc.host) {
            throw new Error('ServiceLocatorOverIpc not initialized');
        }

        return ServiceLocatorOverIpc.host.provider;
    }
}