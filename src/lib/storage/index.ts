import { IStorageAdapter } from './types';
import { LocalStorageAdapter } from './local';

let adapterInstance: IStorageAdapter | null = null;

export function getStorage(): IStorageAdapter {
  if (!adapterInstance) {
    adapterInstance = new LocalStorageAdapter();
  }
  return adapterInstance;
}

export * from './types';
