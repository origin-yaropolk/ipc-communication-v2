import { ExposeService, Service, ServiceLifeTime } from "../ipc-services/decorators";
import { MY_TEST_SERVICE_CONTRACT } from "./contracts";

@ExposeService(ServiceLifeTime.Singleton)
@Service(MY_TEST_SERVICE_CONTRACT)
export class MyTestService implements IMyTestService{
    constructor() {
        console.log('MyTestSevice created!!');
    }

    add(a: number, b: number): number {
        return a + b;
    }

    greet(): string {
        return 'hello from MyTestSevice';
    }
}
