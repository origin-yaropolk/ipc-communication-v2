import { IpcHelper } from '../ipc-core';
import { Disposable } from '../communicators/communicator-base';
import { MessagePortRequester } from '../communicators/message-port-requester';
import { InvokeRequest, IpcProtocol, isDispatchedCallback, makeOutboundArgs } from '../ipc-protocol';

const ignoredMethods = ['then', 'reject'];
const proxyMethods = ['dispose', 'ipcProxyInstanceId', 'ipcProxyCommunicator'];

export type Promisify<T> = {
	[K in keyof T]: T[K] extends (...args: any) => any
		? (...args: Parameters<T[K]>) => Promise<ReturnType<T[K]>>
		: T[K]
	};

function ignoreProxyMethod(name: string): boolean {
	return ignoredMethods.includes(name);
}

function isProxyMethod(name: string): boolean {
	return proxyMethods.includes(name);
}

interface IpcProxyState {
	communicator: MessagePortRequester;
}

interface ProxyFieldContext {
	proxy: IpcProxyState;
	fieldData: Record<string, unknown>; // this property dedicated to store data per field. Each property keep its data into this field context.field
	propKey: string;
}

async function remoteInvoke__<T = unknown>(communicator: MessagePortRequester, method: string, messageType: string, args: any[]): Promise<T> {
	const body: InvokeRequest = {
		method,
		args: makeOutboundArgs(args),
	};

	const response = await communicator.request({
		headers: {
			[IpcProtocol.HEADER_MESSAGE_TYPE]: messageType,
		},
		body,
	});

	return IpcHelper.getResponseBody<T>(response);
}

export function remoteInvoke<T = unknown>(communicator: MessagePortRequester, method: string, args: any[]): Promise<T> {
	return remoteInvoke__<T>(communicator, method, IpcProtocol.MESSAGE_INVOKE, args);
}

/**
 * IpcProxy is a wrapper for remote instance service.
 * IpcProxy instance will implement ProxyHandler<>.get() that returns field value represented as IpcPropertyProxy.
 * For example:
 *
 * const instance = ... // IpcProxy;
 *
 * instance.callFunction(arg); // -> IpcProxy.get() returns IpcPropertyProxy and then call IpcPropertyProxy.apply(...) method for it;
 *
 * instance.myEvent.subscribe(...); // -> IpcProxy.get() returns IpcPropertyProxy and then call IpcPropertyProxy.get(...) method for it
 *  with in turns return proxy-call-wrapper for subscribe method.
 *
 */
class IpcPropertyProxy implements ProxyHandler<ProxyFieldContext> {
	async apply(target: ProxyFieldContext, this_: any, args: any[]): Promise<any> {
		// const instanceId: string = await target.proxy.instanceId();
		const result = await remoteInvoke(target.proxy.communicator, target.propKey, args);

		return result;
	}

	get(context: ProxyFieldContext, propKey: string): any {
		throw new Error(`Unknown ipc-proxy property: (${ propKey })`);
	}
}

const ipcPropertyProxyHandler__ = new IpcPropertyProxy();

export interface IIpcProxy {
	ipcProxyCommunicator(): MessagePortRequester;
}

export class IpcProxy implements ProxyHandler<Record<string, unknown>>, IpcProxyState, IIpcProxy, Disposable {
	private readonly properties: Record<string, unknown> = {};

	readonly communicator: MessagePortRequester;

	static create<T>(channel: MessagePortRequester): Promisify<T> {
		const proxyHandler = new IpcProxy(channel);
        const proxy = new Proxy({}, proxyHandler) as Promisify<T>;
        return proxy;
	}

    /*
	static createForContracts<T>(contracts: string[], comm): T {
		const proxyHandler = new IpcProxy(this.getCommunicator(contracts[0], target), contracts);
		const proxy: unknown = new Proxy({}, proxyHandler);

		return proxy as T;
	}

	// TODO refactor this method
	static createForInstance<T>(instanceId: string, targetId: number, args?: unknown[]): T {
		const communicator = this.getCommunicator(instanceId, target);
		const proxyHandler = new IpcProxy(communicator, instanceId);
		const proxyTarget = this.getProxyTarget(args);
		const proxy: unknown = new Proxy(proxyTarget, proxyHandler);

		return proxy as T;
	}*/

	private static getProxyTarget(args: unknown[] | undefined): object {
		const isArgsHasCallback = args?.some(value => isDispatchedCallback(value));
		const callbackProxyTarget = (): void => {};
		const objectProxyTarget = {};
		return isArgsHasCallback ? callbackProxyTarget : objectProxyTarget;
	}

	static isProxy(instance: unknown): instance is IIpcProxy {
		if (typeof instance !== 'object' || !instance) {
			return false;
		}

		const hasAllProxyMethods = proxyMethods.every(name => name in instance);

		return hasAllProxyMethods;
	}

	constructor(communicator: MessagePortRequester) {
		this.communicator = communicator;
	}

	get(context: Record<string, unknown>, propKey: string): unknown {
		if (ignoreProxyMethod(propKey)) {
			return undefined;
		}

		if (isProxyMethod(propKey) && propKey in this) {
			// just
			return ((this as Record<string, unknown>)[propKey] as (...args: unknown[]) => unknown).bind(this);
		}

		const prop = this.properties[propKey];
		if (prop) {
			return prop;
		}

		const fieldInfo: ProxyFieldContext = {
			proxy: this,
			fieldData: context,
			propKey,
		};

		// proxy context must be a function, to allow using handler 'apply'.
		const propTarget = Object.assign(() => { }, fieldInfo);
		const propProxy = new Proxy(propTarget, ipcPropertyProxyHandler__);
		this.properties[propKey] = propProxy;

		return propProxy;
	}

	has(target: unknown, propKey: string): boolean {
		if (ignoreProxyMethod(propKey)) {
			return false;
		}
		return isProxyMethod(propKey);
	}

	async apply(target_: unknown, this_: unknown, args: unknown[]): Promise<unknown> {
		const result = await remoteInvoke(this.communicator, '', args);

		return result;
	}

	dispose(): void {
		(this.communicator.request({
			headers: {
				[IpcProtocol.HEADER_MESSAGE_TYPE]: IpcProtocol.MESSAGE_DISPOSE,
			},
			body: {},
		})).finally(() => {
			this.communicator.dispose();
		});
	}

	ipcProxyCommunicator(): MessagePortRequester {
		return this.communicator;
	}
}
