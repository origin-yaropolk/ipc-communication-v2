
import { RendererIpcInbox } from "../renderer";
import { ServiceHostRenderer } from "./service-host-renderer";

export abstract class ServiceLocatorOverIpc {
    private static host: ServiceHostRenderer | null = null;

    public static initialize(): void {
        if (!ServiceLocatorOverIpc.host) {
            ServiceLocatorOverIpc.host = new ServiceHostRenderer(new RendererIpcInbox());
        }

        console.warn('ServiceLocatorOverIpc: ServiceHost in this renderer proccess already initialized');
    }
}