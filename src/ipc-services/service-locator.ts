import { Promisify } from "../ipc-communication/proxy/ipc-proxy";
import { RemoteServiceProvider, ServiceProvider } from "./service-provider";

export class ServiceLocator {
    static get<T = unknown>(contracts: string[]): T {
        return ServiceProvider.instance.provide<T>(contracts);
    }

    //static getRemote<T = unknown>(contracts: string[]): Promisify<T> {
    //    // return RemoteServiceProvider.instance.provide<T>(contracts);
    //}
}