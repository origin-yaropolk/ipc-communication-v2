import { ServiceLocatorOverIpc } from "../../services-over-ipc/renderer";
import { MY_RENDERER_TEST_SERVICE_CONTRACT } from "../../services/contracts";
import { IMyRendererTestService } from "../../services/interfaces";

async function startRenderer(): Promise<void> {
    ServiceLocatorOverIpc.initialize();

    const pr = ServiceLocatorOverIpc.provider().provideProxy<IMyRendererTestService>([MY_RENDERER_TEST_SERVICE_CONTRACT]);

    console.log(await pr.sub(1234, 4321));
    console.log(await pr.greet());
    const sub = pr.statusChanged.subscribe((val) => {
        console.log(val);
    });

    setTimeout(() => {
        sub.unsubscribe();
        console.log('unsubed')
    },30000);
}

startRenderer();