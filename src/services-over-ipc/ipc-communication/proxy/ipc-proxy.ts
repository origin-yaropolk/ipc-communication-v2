import { IpcHelper } from '../ipc-core';
import { Disposable } from '../communicators/communicator-base';
import { MessagePortRequester } from '../communicators/message-port-requester';
import { InvokeRequest, IpcProtocol, isDispatchedCallback, makeInboundArgs, makeOutboundArgs } from '../ipc-protocol';
import { Subject, Unsubscribable } from 'rxjs';
import { MessagePortInbox } from '../communicators/message-port-inbox';

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
	requester: MessagePortRequester;
	subscriptionEmitters: Record<string, (...args: unknown[]) => void>;
}

interface ProxyFieldContext {
	proxy: IpcProxyState;
	fieldData: Record<string, unknown>; // this property dedicated to store data per field. Each property keep its data into this field context.field
	propKey: string;
}

class ProxyEventSubscription {
	readonly source = new Subject<unknown>();
	readonly observable = this.source.asObservable();
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
	private static makeSubscribe(context: ProxyFieldContext): (...args: unknown[]) => Unsubscribable {
		if (!(context.propKey in context.fieldData)) {
			Object.defineProperty(context.fieldData, context.propKey, {
				writable: false,
				configurable: true,
				value: new ProxyEventSubscription(),
			});
		}

		return (...args: unknown[]): Unsubscribable => {
			type GenericSubscribeable = { subscribe(...a: unknown[]): Unsubscribable; };
			const eventSubscription: ProxyEventSubscription = Reflect.get(context.fieldData, context.propKey) as ProxyEventSubscription;
			const subscription: Unsubscribable = (<GenericSubscribeable>eventSubscription.observable).subscribe(...args);

			/*
			const hui = {
				[methodName]: (value: unknown) => {
					const eventSource = (Reflect.get(context.fieldData, context.propKey) as ProxyEventSubscription).source;
					eventSource.next(value);
				},
			};
			*/

			context.proxy.subscriptionEmitters[context.propKey] = (value: unknown) => {
				const eventSource = (Reflect.get(context.fieldData, context.propKey) as ProxyEventSubscription).source;
				eventSource.next(value);
			};

			(async(): Promise<void> => {
				await remoteInvoke__(context.proxy.requester, context.propKey, IpcProtocol.MESSAGE_EVENT_SUBSCRIBE, []);
			})();

			return {
				unsubscribe: () => {
					subscription.unsubscribe();
					return remoteInvoke__(context.proxy.requester, context.propKey, IpcProtocol.MESSAGE_EVENT_UNSUBSCRIBE, []);
				},
			};
		};
	}

	async apply(target: ProxyFieldContext, this_: any, args: any[]): Promise<any> {
		// const instanceId: string = await target.proxy.instanceId();
		const result = await remoteInvoke(target.proxy.requester, target.propKey, args);

		return result;
	}

	get(context: ProxyFieldContext, propKey: string): any {
		if (propKey === 'subscribe') {
			return IpcPropertyProxy.makeSubscribe(context);
		}

		throw new Error(`Unknown ipc-proxy property: (${ propKey })`);
	}
}

const ipcPropertyProxyHandler__ = new IpcPropertyProxy();

export class IpcProxy implements ProxyHandler<Record<string, unknown>>, IpcProxyState, Disposable {
	private readonly properties: Record<string, unknown> = {};
	readonly subscriptionEmitters: Record<string, (...args: unknown[]) => void> = {};

	static create<T>(requester: MessagePortRequester, inbox: MessagePortInbox): Promisify<T> {
		const proxyHandler = new IpcProxy(requester, inbox);
        const proxy = new Proxy({}, proxyHandler) as Promisify<T>;
        return proxy;
	}

	constructor(readonly requester: MessagePortRequester, readonly inbox: MessagePortInbox) {
		this.inbox.onRequest.subscribe((request) => {
			if (IpcHelper.hasHeader(request, IpcProtocol.HEADER_MESSAGE_TYPE, IpcProtocol.MESSAGE_EVENT_EMIT)) {
				const invoke = request.body as InvokeRequest;
				const args = makeInboundArgs(invoke.args);

				const prop = this.subscriptionEmitters[invoke.method];
				if(!prop) {
					return;
				}

				prop.apply(this, args);
			}
		});
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
		const result = await remoteInvoke(this.requester, '', args);

		return result;
	}

	dispose(): void {
		(this.requester.request({
			headers: {
				[IpcProtocol.HEADER_MESSAGE_TYPE]: IpcProtocol.MESSAGE_DISPOSE,
			},
			body: {},
		})).finally(() => {
			this.requester.dispose();
		});
	}
}
