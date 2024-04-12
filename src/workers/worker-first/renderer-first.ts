import { ServiceLocatorOverIpc } from "../../services-over-ipc";
import { MY_TEST_SERVICE_CONTRACT } from "../../services/contracts";
import { IMyTestService } from "../../services/interfaces";
import { MyRendererTestService } from "../../services/my-renderer-test-service";

function startServices(...services: unknown[]): void {}

async function startRenderer(): Promise<void> {
    startServices(MyRendererTestService);
    ServiceLocatorOverIpc.initialize();

    const pr = await ServiceLocatorOverIpc.provider().provideProxy<IMyTestService>([MY_TEST_SERVICE_CONTRACT]);

    console.log(await pr.add(7, 7));
    console.log(await pr.greet());
}

startRenderer();