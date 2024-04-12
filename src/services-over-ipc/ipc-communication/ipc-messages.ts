import { InstanceRequest, InvokeRequest, IpcMessage, IpcProtocol, PortRequest, RegisterInstanceRequest } from "./ipc-protocol";

function baseRequest(body: unknown, requestType: IpcProtocol): IpcMessage {
    const message: IpcMessage = {
        headers: {
            [IpcProtocol.HEADER_REQUEST_TYPE]: requestType,
        },
        body
    };

    return message;
}

export function registerInstanceRequest(requestData: RegisterInstanceRequest): IpcMessage {
    return baseRequest(requestData, IpcProtocol.MESSAGE_REGISTER_INSTANCE);
}

export function invokeRequest(requestData: InvokeRequest) {
    return baseRequest(requestData, IpcProtocol.MESSAGE_INVOKE);
}

export function portRequest(requestData: PortRequest): IpcMessage {
    return baseRequest(requestData, IpcProtocol.MESSAGE_PORT_REQUEST);
}

export function instanceRequest(requestData: InstanceRequest): IpcMessage {
    return baseRequest(requestData, IpcProtocol.MESSAGE_GET_INSTANCE);
}

export function emitEventRequest(requestData: InvokeRequest): IpcMessage {
    return baseRequest(requestData, IpcProtocol.MESSAGE_EVENT_EMIT);
}
