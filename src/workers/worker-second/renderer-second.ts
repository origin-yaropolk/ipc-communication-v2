import { RemoteInstanceManager, RendererIpcInbox } from "../../services-over-ipc/renderer";
import { MySecondRendererTestService } from "../../services/my-second-renderer-test-service";

function startServices(...services: unknown[]): void {}

async function startRenderer(): Promise<void> {
    startServices(MySecondRendererTestService);

    const rim = new RemoteInstanceManager(new RendererIpcInbox());
}

startRenderer();