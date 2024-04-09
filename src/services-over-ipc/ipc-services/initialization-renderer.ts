
import { RendererIpcInbox } from "../ipc-communication/ipc-inbox/renderer-ipc-inbox";
import { ServiceHostRenderer } from "./service-host-renderer";
import { ServiceProvider } from "./service-provider";

export abstract class ServiceLocatorOverIpc {
    private static host: ServiceHostRenderer | null = null;

    public static initialize(): void {
        if (!ServiceLocatorOverIpc.host) {
            ServiceLocatorOverIpc.host = new ServiceHostRenderer(new RendererIpcInbox());
            console.log('ServiceLocatorOverIpc initialized');
            return;
        }

        console.warn('ServiceLocatorOverIpc: ServiceHost in this renderer proccess already initialized');
    }

    public static provider(): ServiceProvider {
        if (!ServiceLocatorOverIpc.host) {
            throw new Error('ServiceLocatorOverIpc not initialized');
        }

        return ServiceLocatorOverIpc.host.provider;
    }
}