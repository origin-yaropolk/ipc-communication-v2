import { ExposeService, Service, ServiceLifeTime } from "../services-over-ipc/renderer";
import { MY_RENDERER_TEST_SERVICE_CONTRACT } from "./contracts";

@ExposeService(ServiceLifeTime.Singleton)
@Service(MY_RENDERER_TEST_SERVICE_CONTRACT)
export class MyRendererTestService implements IMyRendererTestService{
    constructor() {
        console.log('MyRendererTestSevice created!!');
    }

    sub(a: number, b: number): number {
        return a - b;
    }

    greet(): string {
        return 'hello from MyRendererTestSevice';
    }
}
