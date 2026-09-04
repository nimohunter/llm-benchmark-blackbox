import { IStorageAdapter } from './types';
import { LocalStorageAdapter } from './local';
import { RedisStorageAdapter } from './redis';

let adapterInstance: IStorageAdapter | null = null;

export function getStorage(): IStorageAdapter {
  if (!adapterInstance) {
    const hasRedis = Boolean(
      (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) ||
      (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN)
    );

    if (hasRedis) {
      try {
        adapterInstance = new RedisStorageAdapter();
      } catch (err) {
        console.error('Failed to initialize RedisStorageAdapter, falling back to LocalStorageAdapter:', err);
        adapterInstance = new LocalStorageAdapter();
      }
    } else {
      adapterInstance = new LocalStorageAdapter();
    }
  }
  return adapterInstance;
}

export * from './types';
