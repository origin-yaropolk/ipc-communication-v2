import { Service } from "../ipc-services/decorators";
import { exposeSingleton } from "../ipc-services/service-provider";
import { MY_RENDERER_TEST_SERVICE_CONTRACT } from "./contracts";

@Service(MY_RENDERER_TEST_SERVICE_CONTRACT)
export class MyRendererTestService implements IMyRendererTestService{
    constructor() {
        exposeSingleton(this);
        console.log('MyRendererTestSevice created!!');
    }

    sub(a: number, b: number): number {
        return a - b;
    }

    greet(): string {
        return 'hello from MyRendererTestSevice';
    }
}
