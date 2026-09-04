import { Redis } from '@upstash/redis';
import { BatterySession, SessionData } from '../engine/types';
import { IStorageAdapter, LeaderboardEntry } from './types';
import { formatLeaderboardEntries } from './utils';
import initialSessions from './seed/initial-sessions.json';
import initialBatteries from './seed/initial-batteries.json';

export class RedisStorageAdapter implements IStorageAdapter {
  private redis: Redis;
  private isSeeded: boolean = false;

  constructor() {
    const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

    if (!url || !token) {
      throw new Error(
        'RedisStorageAdapter: Missing KV_REST_API_URL / UPSTASH_REDIS_REST_URL or corresponding token.'
      );
    }

    this.redis = new Redis({ url, token });
  }

  private async ensureSeeded(): Promise<void> {
    if (this.isSeeded) return;

    try {
      const seeded = await this.redis.get<string>('blackbox:seeded');
      if (!seeded) {
        // 1. Seed initial sessions
        if (Array.isArray(initialSessions) && initialSessions.length > 0) {
          const sessionList = initialSessions as SessionData[];
          for (const s of sessionList) {
            await this.redis.set(`blackbox:session:${s.sessionId}`, s);
            await this.redis.sadd('blackbox:sessions:index', s.sessionId);
          }
        }

        // 2. Seed initial batteries
        if (Array.isArray(initialBatteries) && initialBatteries.length > 0) {
          const batteryList = initialBatteries as BatterySession[];
          for (const b of batteryList) {
            await this.redis.set(`blackbox:battery:${b.batteryId}`, b);
            await this.redis.sadd('blackbox:batteries:index', b.batteryId);
          }
        }

        await this.redis.set('blackbox:seeded', '1');
      }
      this.isSeeded = true;
    } catch (err) {
      console.error('RedisStorageAdapter: Error while ensuring seeded state:', err);
    }
  }

  async saveSession(session: SessionData): Promise<void> {
    await this.ensureSeeded();
    await this.redis.set(`blackbox:session:${session.sessionId}`, session);
    await this.redis.sadd('blackbox:sessions:index', session.sessionId);
  }

  async getSession(sessionId: string): Promise<SessionData | null> {
    await this.ensureSeeded();
    const session = await this.redis.get<SessionData>(`blackbox:session:${sessionId}`);
    return session || null;
  }

  async getAllSessions(): Promise<SessionData[]> {
    await this.ensureSeeded();
    const ids = await this.redis.smembers<string[]>('blackbox:sessions:index');
    if (!ids || ids.length === 0) return [];

    const pipeline = this.redis.pipeline();
    for (const id of ids) {
      pipeline.get(`blackbox:session:${id}`);
    }
    const results = await pipeline.exec<SessionData[]>();
    return results.filter(Boolean);
  }

  async getLeaderboard(): Promise<LeaderboardEntry[]> {
    const sessions = await this.getAllSessions();
    return formatLeaderboardEntries(sessions);
  }

  async saveBattery(battery: BatterySession): Promise<void> {
    await this.ensureSeeded();
    await this.redis.set(`blackbox:battery:${battery.batteryId}`, battery);
    await this.redis.sadd('blackbox:batteries:index', battery.batteryId);
  }

  async getBattery(batteryId: string): Promise<BatterySession | null> {
    await this.ensureSeeded();
    const battery = await this.redis.get<BatterySession>(`blackbox:battery:${batteryId}`);
    return battery || null;
  }

  async getAllBatteries(): Promise<BatterySession[]> {
    await this.ensureSeeded();
    const ids = await this.redis.smembers<string[]>('blackbox:batteries:index');
    if (!ids || ids.length === 0) return [];

    const pipeline = this.redis.pipeline();
    for (const id of ids) {
      pipeline.get(`blackbox:battery:${id}`);
    }
    const results = await pipeline.exec<BatterySession[]>();
    return results.filter(Boolean);
  }
}
