import { Subject } from "rxjs";
import { ExposeService, Service, ServiceLifeTime } from "../services-over-ipc/renderer";
import { MY_RENDERER_TEST_SERVICE_CONTRACT } from "./contracts";
import { IMyRendererTestService } from "./interfaces";

@ExposeService(ServiceLifeTime.Singleton)
@Service(MY_RENDERER_TEST_SERVICE_CONTRACT)
export class MyRendererTestService implements IMyRendererTestService {
    private readonly statusChangedEvent = new Subject<number>();
	readonly statusChanged = this.statusChangedEvent.asObservable();

    constructor() {
        console.log('MyRendererTestSevice created!!');
        setInterval(() => {
            this.statusChangedEvent.next((new Date()).getTime());
        }, 4000);
    }

    sub(a: number, b: number): number {
        return a - b;
    }

    greet(): string {
        return 'hello from MyRendererTestSevice';
    }

    changeStatus(newNumber: number): void {
        this.statusChangedEvent.next(newNumber);
    }
}
