import { BatterySession, SessionData } from '../engine/types';
import { IStorageAdapter, LeaderboardEntry } from './types';
import { formatLeaderboardEntries } from './utils';
import fs from 'fs';
import path from 'path';
import initialSessions from './seed/initial-sessions.json';
import initialBatteries from './seed/initial-batteries.json';

// Global memory cache surviving hot reloads
const globalStore = globalThis as unknown as {
  __blackbox_sessions?: Map<string, SessionData>;
  __blackbox_batteries?: Map<string, BatterySession>;
};

if (!globalStore.__blackbox_sessions) {
  globalStore.__blackbox_sessions = new Map<string, SessionData>();
}
if (!globalStore.__blackbox_batteries) {
  globalStore.__blackbox_batteries = new Map<string, BatterySession>();
}

export class LocalStorageAdapter implements IStorageAdapter {
  private dataDir: string;
  private sessionsFile: string;
  private batteriesFile: string;

  constructor() {
    this.dataDir = path.join(process.cwd(), '.data');
    this.sessionsFile = path.join(this.dataDir, 'sessions.json');
    this.batteriesFile = path.join(this.dataDir, 'batteries.json');
    this.loadFromDisk();
  }

  private loadFromDisk() {
    // 1. Load sessions
    try {
      if (fs.existsSync(this.sessionsFile)) {
        const raw = fs.readFileSync(this.sessionsFile, 'utf-8');
        const list: SessionData[] = JSON.parse(raw);
        for (const s of list) {
          globalStore.__blackbox_sessions!.set(s.sessionId, s);
        }
      }
    } catch {
      // Disk read error
    }

    // Fallback if memory is empty
    if (globalStore.__blackbox_sessions!.size === 0 && Array.isArray(initialSessions)) {
      for (const s of initialSessions as SessionData[]) {
        globalStore.__blackbox_sessions!.set(s.sessionId, s);
      }
    }

    // 2. Load batteries
    try {
      if (fs.existsSync(this.batteriesFile)) {
        const raw = fs.readFileSync(this.batteriesFile, 'utf-8');
        const list: BatterySession[] = JSON.parse(raw);
        for (const b of list) {
          globalStore.__blackbox_batteries!.set(b.batteryId, b);
        }
      }
    } catch {
      // Disk read error
    }

    // Fallback if memory is empty
    if (globalStore.__blackbox_batteries!.size === 0 && Array.isArray(initialBatteries)) {
      for (const b of initialBatteries as BatterySession[]) {
        globalStore.__blackbox_batteries!.set(b.batteryId, b);
      }
    }
  }

  private saveSessionsToDisk() {
    try {
      if (!fs.existsSync(this.dataDir)) {
        fs.mkdirSync(this.dataDir, { recursive: true });
      }
      const list = Array.from(globalStore.__blackbox_sessions!.values());
      fs.writeFileSync(this.sessionsFile, JSON.stringify(list, null, 2));
    } catch {
      // Ignore disk write errors in read-only environments
    }
  }

  private saveBatteriesToDisk() {
    try {
      if (!fs.existsSync(this.dataDir)) {
        fs.mkdirSync(this.dataDir, { recursive: true });
      }
      const list = Array.from(globalStore.__blackbox_batteries!.values());
      fs.writeFileSync(this.batteriesFile, JSON.stringify(list, null, 2));
    } catch {
      // Ignore disk write errors in read-only environments
    }
  }

  async saveSession(session: SessionData): Promise<void> {
    globalStore.__blackbox_sessions!.set(session.sessionId, session);
    this.saveSessionsToDisk();
  }

  async getSession(sessionId: string): Promise<SessionData | null> {
    this.loadFromDisk();
    return globalStore.__blackbox_sessions!.get(sessionId) || null;
  }

  async getAllSessions(): Promise<SessionData[]> {
    this.loadFromDisk();
    return Array.from(globalStore.__blackbox_sessions!.values());
  }

  async saveBattery(battery: BatterySession): Promise<void> {
    globalStore.__blackbox_batteries!.set(battery.batteryId, battery);
    this.saveBatteriesToDisk();
  }

  async getBattery(batteryId: string): Promise<BatterySession | null> {
    this.loadFromDisk();
    return globalStore.__blackbox_batteries!.get(batteryId) || null;
  }

  async getAllBatteries(): Promise<BatterySession[]> {
    this.loadFromDisk();
    return Array.from(globalStore.__blackbox_batteries!.values());
  }

  async getLeaderboard(): Promise<LeaderboardEntry[]> {
    this.loadFromDisk();
    const sessions = Array.from(globalStore.__blackbox_sessions!.values());
    return formatLeaderboardEntries(sessions);
  }
}
