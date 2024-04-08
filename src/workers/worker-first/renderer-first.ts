import { RemoteInstanceManager, RendererIpcInbox } from "../../services-over-ipc/renderer";

function startServices(...services: unknown[]): void {}

/*
async function getService(): Promise<Promisify<IMyTestService>> {
    if (!serv) {
        const body: IpcP.InstanceRequest = {
            contracts: [MY_TEST_SERVICE_CONTRACT],
        };
        
        const instanceRequest: IpcMessage = {
            headers: {
                [IpcP.HEADER_MESSAGE_TYPE]: IpcP.MESSAGE_GET_INSTANCE,
            },
            body,
        };
        
        const hui = await ipcCommunicator.send(instanceRequest);
        const p = extractPort(hui.body);

        if (!p) {
            throw new Error('Not port recieved');
        }

        const c = new MessagePortRendererRequester(p);
        const service = IpcProxy.create<IMyTestService>(c);

        const res = await service.add(1, 2);
        const gre = await service.greet();

        console.log(res);
        console.log(gre);

        serv = service;
    }

    return serv;
}
*/

async function startRenderer(): Promise<void> {
    const rim = new RemoteInstanceManager(new RendererIpcInbox());
}

startRenderer();