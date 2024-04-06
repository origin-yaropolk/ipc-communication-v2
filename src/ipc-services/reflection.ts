import { GenericConstructor, SERVICE_CONTRACTS_METAKEY } from "./decorators";

export interface ServiceMethodDescription {
	name: string;
}

export interface ServiceDescription {
	contracts: string[];
	methods: ServiceMethodDescription[];
}

export enum ReflectionAspect {
	Contracts,
	Methods,
}

export interface IServiceReflector {
	reflectInstance(instance: unknown, ...aspects: ReflectionAspect[]): Promise<ServiceDescription> | undefined;
}

export function isServiceReflector(value: unknown): value is IServiceReflector {
	return typeof value === 'object' && (value as { reflectInstance: unknown; }).reflectInstance instanceof Function;
}

function* inheritanceChain(instance: unknown): Iterable<GenericConstructor> {
	if (typeof instance === 'object' && instance) {
		// eslint-disable-next-line @typescript-eslint/ban-types
		let ctor: Function | undefined = instance.constructor;
		while (ctor) {
			yield ctor as GenericConstructor;
			const proto: unknown = Object.getPrototypeOf(ctor);
			if (typeof proto !== 'function' || proto === Object) {
				break;
			}

			ctor = proto;
		}
	}
}

function* allValuableProperties(instance: unknown): Iterable<{ key: string; value: unknown; }> {
	const excludedProperties = ['constructor', 'isMounted', 'replaceState'];

	if (typeof instance === 'object' && instance) {
		let container: Record<string, unknown> | undefined = instance as Record<string, unknown>;

		// eslint-disable-next-line @typescript-eslint/ban-types
		while (container && container.constructor !== Object) {
			const keys = Object
				.getOwnPropertyNames(container)
				.filter(k => {
					return !excludedProperties.includes(k);
				});

			for (const key of keys) {
				try {
					const value: unknown = (instance as Record<string, unknown>)[key];
					yield { key, value };
				}
				catch (error: unknown) {
					console.error(`Fail to get property [${ key }]: ${ (error) }`);
				}
			}

			container = Object.getPrototypeOf(container) as Record<string, unknown> | undefined;
		}
	}
}

/**
 *
 */
export function reflectLocalInstance(instance: unknown, ...aspects: ReflectionAspect[]): ServiceDescription | undefined {
	if (typeof instance !== 'object' || !instance) {
		return undefined;
	}

	const needToReflect = (aspect: ReflectionAspect): boolean => {
		return !aspects || aspects.length === 0 || aspects.includes(aspect);
	};

	const contracts: string[] = [];

	if (needToReflect(ReflectionAspect.Contracts)) {
		for (const ctor of inheritanceChain(instance)) {
			const metaValue: unknown = ctor ? Reflect.getMetadata(SERVICE_CONTRACTS_METAKEY, ctor) : undefined;
			if (metaValue) {
				contracts.push(...metaValue as string[]);
			}
		}
	}

	const methods: ServiceMethodDescription[] = [];

	if (needToReflect(ReflectionAspect.Methods)) {
		for (const { key, value } of allValuableProperties(instance)) {
			if (value instanceof Function) {
				methods.push({
					name: key,
				});
			}
		}
	}

	return {
		contracts,
		methods,
	};
}
