import { ipcMain } from 'electron';

import { MainIpcInbox } from '../ipc-communication/ipc-inbox/main-ipc-inbox';
import { RendererIpcInbox } from '../ipc-communication/ipc-inbox/renderer-ipc-inbox';
import { AbstractServiceHost } from './abstract-service-host';
import { ServiceHost } from './service-host';
import { ServiceHostRenderer } from './service-host-renderer';
import { ServiceProvider } from './service-provider';

export abstract class GlobalState {
	private static host: AbstractServiceHost | null = null;

	public static initialize(): void {
		if (!GlobalState.host) {
			GlobalState.host = GlobalState.createHost();
			return;
		}

		console.warn('ServiceLocatorOverIpc: ServiceHost in this proccess already initialized');
	}

	public static provider(): ServiceProvider {
		if (!GlobalState.host) {
			throw new Error('ServiceLocatorOverIpc not initialized');
		}

		return GlobalState.host.provider;
	}

	private static createHost(): AbstractServiceHost {
		if (ipcMain) {
			return new ServiceHost(new MainIpcInbox());
		}

		return new ServiceHostRenderer(new RendererIpcInbox());
	}
}
