import { ExposeService, Service, ServiceLifeTime } from "../ipc-services/decorators";
import { exposeSingleton } from "../ipc-services/service-provider";
import { MY_SECOND_RENDERER_TEST_SERIVCE_CONTRACT } from "./contracts";

@ExposeService(ServiceLifeTime.Singleton)
@Service(MY_SECOND_RENDERER_TEST_SERIVCE_CONTRACT)
export class MySecondRendererTestService implements IMySecondRendererTestService{
    constructor() {
        exposeSingleton(this);
        console.log('MySecondRendererTestService created!!');
    }

    mul(a: number, b: number): number {
        return a * b;
    }

    greet(): string {
        return 'hello from MySecondRendererTestService';
    }
}
