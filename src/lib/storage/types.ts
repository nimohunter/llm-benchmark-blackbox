import { BatterySession, SessionData } from '../engine/types';

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
  domain?: string;
  scenarioName?: string;
  badgeColor?: string;
}

export interface IStorageAdapter {
  saveSession(session: SessionData): Promise<void>;
  getSession(sessionId: string): Promise<SessionData | null>;
  getAllSessions(): Promise<SessionData[]>;
  getLeaderboard(): Promise<LeaderboardEntry[]>;

  saveBattery(battery: BatterySession): Promise<void>;
  getBattery(batteryId: string): Promise<BatterySession | null>;
  getAllBatteries(): Promise<BatterySession[]>;
}
