import { InstanceRequest, IpcMessage, IpcProtocol, PortRequest, RegisterInstanceRequest } from "./ipc-protocol";

export function registerInstanceRequest(contracts: string[]): IpcMessage {
    const body: RegisterInstanceRequest = { contracts };
    
    const message: IpcMessage = {
        headers: {
            [IpcProtocol.HEADER_MESSAGE_TYPE]: IpcProtocol.MESSAGE_REGISTER_INSTANCE,
        },
        body,
    };

    return message
}

export function portRequest(contracts: string[]): IpcMessage {
    const body: PortRequest = { contracts };
    
    const message: IpcMessage = {
        headers: {
            [IpcProtocol.HEADER_MESSAGE_TYPE]: IpcProtocol.MESSAGE_PORT_REQUEST,
        },
        body
    };

    return message
}

export function instanceRequest(contracts: string[]): IpcMessage {
    const body: InstanceRequest = { contracts };
    
    const message: IpcMessage = {
        headers: {
            [IpcProtocol.HEADER_MESSAGE_TYPE]: IpcProtocol.MESSAGE_GET_INSTANCE,
        },
        body
    };

    return message;
}