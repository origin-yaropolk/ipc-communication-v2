import { ServiceLocatorOverIpc } from "../../services-over-ipc";
import { MyRendererTestService } from "../../services/my-renderer-test-service";
import { MySecondRendererTestService } from "../../services/my-second-renderer-test-service";

function startServices(...services: unknown[]): void {}

async function startRenderer(): Promise<void> {
    startServices([MyRendererTestService]);
    ServiceLocatorOverIpc.initialize();
}

startRenderer();