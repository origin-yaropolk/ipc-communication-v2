import { Subject } from "rxjs";
import { ExposeService, Service, ServiceLifeTime } from "../services-over-ipc";
import { MY_TEST_SERVICE_CONTRACT } from "./contracts";
import { IMyTestService } from "./interfaces";


@ExposeService(ServiceLifeTime.Singleton)
@Service(MY_TEST_SERVICE_CONTRACT)
export class MyTestService implements IMyTestService {
	private readonly statusChangedEvent = new Subject<number>();
	readonly statusChanged = this.statusChangedEvent.asObservable();

    constructor() {
        console.log('MyTestSevice created!!');
    }

    add(a: number, b: number): number {
        return a + b;
    }

    greet(): string {
        return 'hello from MyTestSevice';
    }

    changeStatus(newNumber: number): void {
        this.statusChangedEvent.next(newNumber);
    }
}
