import { SessionData } from '../engine/types';

export interface LeaderboardEntry {
  sessionId: string;
  modelName: string;
  seed: string;
  archetypeId: string;
  difficulty: string;
  totalScore: number;
  recovery: number;
  rcaAccuracy: number;
  safety: number;
  efficiency: number;
  solved: boolean;
  turnsUsed: number;
  budgetRemaining: number;
  finishedAt: string;
  isLadder: boolean;
  levelsCleared?: number;
}

export interface IStorageAdapter {
  saveSession(session: SessionData): Promise<void>;
  getSession(sessionId: string): Promise<SessionData | null>;
  getLeaderboard(): Promise<LeaderboardEntry[]>;
}
