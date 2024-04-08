import { uuid } from 'uuidv4';

export interface Disposable {
	dispose(): void;
}


export function getUID(): string {
	return uuid();
}

export interface Invocation {
	id: number;
	resolve(value: any): void;
	reject(error: Error): void;
	invocationTimeout: unknown;
}

export const HEADER_INVOKE_ID = 'comm:invoke-id';
export const HEADER_COMMUNICATOR_ID = 'comm:id';