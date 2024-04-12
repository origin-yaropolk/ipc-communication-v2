import { ServiceLocatorOverIpc } from "../../services-over-ipc";
import { MySecondRendererTestService } from "../../services/my-second-renderer-test-service";

function startServices(...services: unknown[]): void {}

async function startRenderer(): Promise<void> {
    startServices(MySecondRendererTestService);
    ServiceLocatorOverIpc.initialize();
}

startRenderer();