import { SessionData } from '../engine/types';
import { IStorageAdapter, LeaderboardEntry } from './types';
import fs from 'fs';
import path from 'path';

// Global memory cache surviving hot reloads
const globalStore = globalThis as unknown as {
  __blackbox_sessions?: Map<string, SessionData>;
};

if (!globalStore.__blackbox_sessions) {
  globalStore.__blackbox_sessions = new Map<string, SessionData>();
}

export class LocalStorageAdapter implements IStorageAdapter {
  private dataDir: string;
  private filePath: string;

  constructor() {
    this.dataDir = path.join(process.cwd(), '.data');
    this.filePath = path.join(this.dataDir, 'sessions.json');
    this.loadFromDisk();
  }

  private loadFromDisk() {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf-8');
        const list: SessionData[] = JSON.parse(raw);
        globalStore.__blackbox_sessions!.clear();
        for (const s of list) {
          globalStore.__blackbox_sessions!.set(s.sessionId, s);
        }
      }
    } catch {
      // Ignore initial file read errors
    }
  }

  private saveToDisk() {
    try {
      if (!fs.existsSync(this.dataDir)) {
        fs.mkdirSync(this.dataDir, { recursive: true });
      }
      const list = Array.from(globalStore.__blackbox_sessions!.values());
      fs.writeFileSync(this.filePath, JSON.stringify(list, null, 2));
    } catch {
      // Ignore disk write errors in read-only environments
    }
  }

  async saveSession(session: SessionData): Promise<void> {
    globalStore.__blackbox_sessions!.set(session.sessionId, session);
    this.saveToDisk();
  }

  async getSession(sessionId: string): Promise<SessionData | null> {
    this.loadFromDisk();
    return globalStore.__blackbox_sessions!.get(sessionId) || null;
  }

  async getLeaderboard(): Promise<LeaderboardEntry[]> {
    this.loadFromDisk();
    const sessions = Array.from(globalStore.__blackbox_sessions!.values());
    const scored = sessions.filter((s) => s.finalScore !== undefined);

    const entries: LeaderboardEntry[] = scored.map((s) => {
      const isLadder = s.seed.startsWith('ladder-') || s.sessionId.startsWith('bat-') || s.modelName.includes('/8]');
      let levelsCleared = 0;
      if (s.seed === 'ladder-grandmaster-all8' || s.modelName.includes('8/8 CLEARED')) {
        levelsCleared = 8;
      } else if (s.seed.startsWith('ladder-knockout-L')) {
        const match = s.seed.match(/L(\d+)/);
        levelsCleared = match ? Math.max(0, parseInt(match[1]) - 1) : 0;
      } else if (s.modelName.match(/\[L(\d+)\/8\]/)) {
        const match = s.modelName.match(/\[L(\d+)\/8\]/);
        levelsCleared = match ? parseInt(match[1]) : 1;
      } else if (isLadder) {
        levelsCleared = 1;
      }

      return {
        sessionId: s.sessionId,
        modelName: s.modelName,
        seed: s.seed,
        archetypeId: s.archetypeId,
        difficulty: s.difficulty,
        totalScore: s.finalScore!.total,
        recovery: s.finalScore!.recovery,
        rcaAccuracy: s.finalScore!.rcaAccuracy,
        safety: s.finalScore!.safety,
        efficiency: s.finalScore!.efficiency,
        solved: s.solved,
        turnsUsed: s.currentTurn,
        budgetRemaining: s.budgetRemaining,
        finishedAt: s.finishedAt || s.createdAt,
        isLadder,
        levelsCleared,
      };
    });

    return entries.sort((a, b) => b.totalScore - a.totalScore);
  }
}
