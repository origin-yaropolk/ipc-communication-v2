import { ServiceLocatorOverIpc } from "../../services-over-ipc/renderer";
import { MY_RENDERER_TEST_SERVICE_CONTRACT } from "../../services/contracts";

async function startRenderer(): Promise<void> {

    ServiceLocatorOverIpc.initialize();

    const pr = await ServiceLocatorOverIpc.provider().provideProxy<IMyRendererTestService>([MY_RENDERER_TEST_SERVICE_CONTRACT]);

    console.log(await pr.sub(1234, 4321));
    console.log(await pr.greet());
}

startRenderer();