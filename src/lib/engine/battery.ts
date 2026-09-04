import { ArchetypeId, BatterySession, DifficultyTier, RcaSubmission, SessionData, TurnRecord } from './types';
import { BlackBoxSimulator } from './simulator';
import { getStorage } from '../storage';
import { PRNG } from './prng';

export interface LadderLevelConfig {
  level: number;
  name: string;
  domain: 'Queue' | 'Ops' | 'Network' | 'Storage';
  archetypeId: ArchetypeId;
  difficulty: DifficultyTier;
  seed: string;
  summary: string;
}

export const LADDER_8_LEVELS: LadderLevelConfig[] = [
  {
    level: 1,
    name: 'Queue: Deserialization Panic',
    domain: 'Queue',
    archetypeId: 'POISON_PILL_PANIC',
    difficulty: 'tier-1',
    seed: 'std-seed-q1-easy',
    summary: 'Explicit stack trace in worker deserializer; missing currency key.',
  },
  {
    level: 2,
    name: 'Ops: Vault Token Rotation Desync',
    domain: 'Ops',
    archetypeId: 'AUTH_TOKEN_ROTATION_DESYNC',
    difficulty: 'tier-2',
    seed: 'std-seed-o7-med',
    summary: 'Clear 401 error after secret rotation; flush in-memory auth cache.',
  },
  {
    level: 3,
    name: 'Queue: Poison Pill & Red-Herring Cascade',
    domain: 'Queue',
    archetypeId: 'POISON_PILL_PANIC',
    difficulty: 'tier-2',
    seed: 'bench-prod-402',
    summary: 'Head-of-line blocking + external distractor log; route corrupt msg to DLQ.',
  },
  {
    level: 4,
    name: 'Network: Timeout & Pool Starvation',
    domain: 'Network',
    archetypeId: 'TIMEOUT_POOL_STARVATION',
    difficulty: 'tier-2',
    seed: 'std-seed-n5-med',
    summary: 'Slow external partner holds DB transaction locks; set client timeout.',
  },
  {
    level: 5,
    name: 'Storage: Concurrency Lost Update',
    domain: 'Storage',
    archetypeId: 'LOST_UPDATE_CONCURRENCY',
    difficulty: 'tier-2',
    seed: 'std-seed-s3-med',
    summary: 'Flash sale race condition on balances; apply optimistic locking.',
  },
  {
    level: 6,
    name: 'Network: Cascading Lock Leak',
    domain: 'Network',
    archetypeId: 'TIMEOUT_POOL_STARVATION',
    difficulty: 'tier-3',
    seed: 'std-seed-n6-hard',
    summary: 'Cascading timeout outage across microservices; decouple calls from DB.',
  },
  {
    level: 7,
    name: 'Ops: Secret Desync & Lockout',
    domain: 'Ops',
    archetypeId: 'AUTH_TOKEN_ROTATION_DESYNC',
    difficulty: 'tier-3',
    seed: 'std-seed-o8-hard',
    summary: 'High-concurrency auth rejections; configure token refresh TTL loop.',
  },
  {
    level: 8,
    name: 'Storage: Silent Ledger Invariant Drift (Nightmare Boss)',
    domain: 'Storage',
    archetypeId: 'LOST_UPDATE_CONCURRENCY',
    difficulty: 'tier-3',
    seed: 'std-seed-s4-hard',
    summary: 'System returns 200 OK with zero crash logs; reconcile hidden audit drift.',
  },
];

import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), '.data');
const BATTERIES_FILE = path.join(DATA_DIR, 'batteries.json');

// In-memory battery store attached to globalThis
const globalStore = globalThis as unknown as {
  __blackbox_batteries?: Map<string, BatterySession>;
};

if (!globalStore.__blackbox_batteries) {
  globalStore.__blackbox_batteries = new Map<string, BatterySession>();
}

export function loadBatteriesFromDisk(): void {
  try {
    if (fs.existsSync(BATTERIES_FILE)) {
      const raw = fs.readFileSync(BATTERIES_FILE, 'utf-8');
      const list: BatterySession[] = JSON.parse(raw);
      for (const b of list) {
        globalStore.__blackbox_batteries!.set(b.batteryId, b);
      }
    }
  } catch {
    // Ignore errors
  }
}

export function saveBatteriesToDisk(): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const list = Array.from(globalStore.__blackbox_batteries!.values());
    fs.writeFileSync(BATTERIES_FILE, JSON.stringify(list, null, 2));
  } catch {
    // Ignore errors
  }
}

// Initial load
loadBatteriesFromDisk();

export class BatteryController {
  public static async getAllBatteries(): Promise<BatterySession[]> {
    loadBatteriesFromDisk();
    return Array.from(globalStore.__blackbox_batteries!.values());
  }

  public static async createBattery(modelName: string): Promise<BatterySession> {
    const prng = new PRNG(`battery-${Date.now()}-${modelName}`);
    const batteryId = `bat-${prng.nextId('exam')}`;

    const firstLevel = LADDER_8_LEVELS[0];
    const initialSession = BlackBoxSimulator.createSession(
      modelName,
      firstLevel.seed,
      firstLevel.archetypeId,
      firstLevel.difficulty
    );

    const storage = getStorage();
    await storage.saveSession(initialSession);

    const battery: BatterySession = {
      batteryId,
      modelName,
      createdAt: new Date().toISOString(),
      currentLevel: 1,
      totalLevels: 8,
      status: 'IN_PROGRESS',
      currentSessionId: initialSession.sessionId,
      results: [],
      levelsCleared: 0,
    };

    globalStore.__blackbox_batteries!.set(batteryId, battery);
    saveBatteriesToDisk();
    return battery;
  }

  public static async getBattery(batteryId: string): Promise<BatterySession | null> {
    if (!globalStore.__blackbox_batteries!.has(batteryId)) {
      loadBatteriesFromDisk();
    }
    return globalStore.__blackbox_batteries!.get(batteryId) || null;
  }

  public static async getCurrentLevelInfo(batteryId: string) {
    const battery = await this.getBattery(batteryId);
    if (!battery) throw new Error(`Battery not found: ${batteryId}`);

    const storage = getStorage();
    const session = await storage.getSession(battery.currentSessionId);
    if (!session) throw new Error(`Session not found: ${battery.currentSessionId}`);

    const levelConfig = LADDER_8_LEVELS[battery.currentLevel - 1];
    const brief = BlackBoxSimulator.getBrief(session);

    return {
      battery_id: battery.batteryId,
      model_name: battery.modelName,
      status: battery.status,
      current_level: battery.currentLevel,
      total_levels: 8,
      level_config: levelConfig,
      current_session_id: session.sessionId,
      brief,
    };
  }

  public static async advanceBattery(batteryId: string, rca: RcaSubmission) {
    const battery = await this.getBattery(batteryId);
    if (!battery) throw new Error(`Battery not found: ${batteryId}`);

    if (battery.status !== 'IN_PROGRESS') {
      return {
        status: battery.status,
        message: `This battery exam has already concluded (${battery.status}).`,
        levels_cleared: `${battery.levelsCleared}/8`,
        composite_score: battery.compositeScore,
      };
    }

    const storage = getStorage();
    const currentSession = await storage.getSession(battery.currentSessionId);
    if (!currentSession) throw new Error(`Session not found: ${battery.currentSessionId}`);

    // Grade current problem
    const finishResult = BlackBoxSimulator.finish(currentSession, rca);
    await storage.saveSession(currentSession);

    const currentLevelConfig = LADDER_8_LEVELS[battery.currentLevel - 1];
    const isPassed =
      currentSession.solved &&
      finishResult.score.recovery > 0 &&
      !currentSession.state.activeIncident.blastRadiusTriggered;

    const levelResult = {
      level: battery.currentLevel,
      problemName: currentLevelConfig.name,
      domain: currentLevelConfig.domain,
      difficulty: currentLevelConfig.difficulty,
      sessionId: currentSession.sessionId,
      score: finishResult.score,
      solved: isPassed,
      turnsUsed: currentSession.currentTurn,
      budgetRemaining: currentSession.budgetRemaining,
      finishedAt: new Date().toISOString(),
    };
    battery.results.push(levelResult);

    // Fail-fast Early Termination check
    if (!isPassed) {
      battery.status = 'KNOCKED_OUT';
      battery.finishedAt = new Date().toISOString();
      battery.knockoutReason = finishResult.score.details?.antiCheatDisqualified
        ? `DISQUALIFIED on Level ${battery.currentLevel}: Anti-cheat tripwire triggered (out-of-band static asset scraping).`
        : `Failed Level ${battery.currentLevel} (${currentLevelConfig.name}): System remained degraded or triggered blast radius.`;
      
      if (finishResult.score.details?.antiCheatDisqualified && !battery.modelName.includes('[DISQUALIFIED]')) {
        battery.modelName += ' [DISQUALIFIED: CHEATING]';
      }
      
      const totalScoreSum = battery.results.reduce((acc, r) => acc + r.score.total, 0);
      battery.compositeScore = Math.round(totalScoreSum / 8);

      // Save summary session to leaderboard
      const leaderboardSession = BlackBoxSimulator.createSession(
        battery.modelName,
        `ladder-knockout-L${battery.currentLevel}`,
        currentLevelConfig.archetypeId,
        currentLevelConfig.difficulty
      );
      leaderboardSession.finalScore = {
        recovery: Math.round(battery.results.reduce((a, b) => a + b.score.recovery, 0) / 8),
        rcaAccuracy: Math.round(battery.results.reduce((a, b) => a + b.score.rcaAccuracy, 0) / 8),
        safety: Math.round(battery.results.reduce((a, b) => a + b.score.safety, 0) / 8),
        efficiency: Math.round(battery.results.reduce((a, b) => a + b.score.efficiency, 0) / 8),
        total: battery.compositeScore,
        details: {
          systemHealthy: false,
          queueCleared: false,
          dataIntegrityMaintained: false,
          serviceMatch: false,
          categoryMatch: false,
          triggerMatch: false,
          stagingUsed: true,
          zeroRegressions: false,
          turnsUsed: battery.results.reduce((a, b) => a + b.turnsUsed, 0),
          budgetRemaining: 0,
        },
      };
      leaderboardSession.modelName = `${battery.modelName} [L${battery.levelsCleared}/8]`;
      leaderboardSession.solved = false;
      leaderboardSession.finishedAt = battery.finishedAt;
      // Collect all turns across all levels for multi-turn replay
      const allTurns: TurnRecord[] = [];
      for (const res of battery.results) {
        const lvlSess = await storage.getSession(res.sessionId);
        if (lvlSess && lvlSess.trajectory) {
          allTurns.push(...lvlSess.trajectory);
        }
      }
      leaderboardSession.sessionId = battery.batteryId;
      leaderboardSession.trajectory = allTurns;
      await storage.saveSession(leaderboardSession);
      saveBatteriesToDisk();

      return {
        status: 'KNOCKED_OUT',
        message: battery.knockoutReason,
        levels_cleared: `${battery.levelsCleared} of 8`,
        failed_level: battery.currentLevel,
        level_score: finishResult.score,
        final_composite_score: battery.compositeScore,
        level_history: battery.results,
      };
    }

    // Current level passed!
    battery.levelsCleared += 1;

    // Check if this was the final level (Boss defeated!)
    if (battery.currentLevel === 8) {
      battery.status = 'COMPLETED';
      battery.finishedAt = new Date().toISOString();
      const totalScoreSum = battery.results.reduce((acc, r) => acc + r.score.total, 0);
      battery.compositeScore = Math.round(totalScoreSum / 8);

      // Save grandmaster session to leaderboard
      const leaderboardSession = BlackBoxSimulator.createSession(
        battery.modelName,
        'ladder-grandmaster-all8',
        currentLevelConfig.archetypeId,
        currentLevelConfig.difficulty
      );
      leaderboardSession.finalScore = {
        recovery: Math.round(battery.results.reduce((a, b) => a + b.score.recovery, 0) / 8),
        rcaAccuracy: Math.round(battery.results.reduce((a, b) => a + b.score.rcaAccuracy, 0) / 8),
        safety: Math.round(battery.results.reduce((a, b) => a + b.score.safety, 0) / 8),
        efficiency: Math.round(battery.results.reduce((a, b) => a + b.score.efficiency, 0) / 8),
        total: battery.compositeScore,
        details: {
          systemHealthy: true,
          queueCleared: true,
          dataIntegrityMaintained: true,
          serviceMatch: true,
          categoryMatch: true,
          triggerMatch: true,
          stagingUsed: true,
          zeroRegressions: true,
          turnsUsed: battery.results.reduce((a, b) => a + b.turnsUsed, 0),
          budgetRemaining: currentSession.budgetRemaining,
        },
      };
      leaderboardSession.modelName = `${battery.modelName} [8/8 CLEARED 🏆]`;
      leaderboardSession.solved = true;
      leaderboardSession.finishedAt = battery.finishedAt;

      const allTurns: TurnRecord[] = [];
      for (const res of battery.results) {
        const lvlSess = await storage.getSession(res.sessionId);
        if (lvlSess && lvlSess.trajectory) {
          allTurns.push(...lvlSess.trajectory);
        }
      }
      leaderboardSession.sessionId = battery.batteryId;
      leaderboardSession.trajectory = allTurns;
      await storage.saveSession(leaderboardSession);
      saveBatteriesToDisk();

      return {
        status: 'BATTERY_COMPLETED',
        message: '🏆 GRANDMASTER SRE CERTIFIED! All 8 Levels Cleared!',
        levels_cleared: '8 of 8',
        final_composite_score: battery.compositeScore,
        level_history: battery.results,
      };
    }

    // Advance to next level automatically
    battery.currentLevel += 1;
    const nextLevelConfig = LADDER_8_LEVELS[battery.currentLevel - 1];
    const nextSession = BlackBoxSimulator.createSession(
      battery.modelName,
      nextLevelConfig.seed,
      nextLevelConfig.archetypeId,
      nextLevelConfig.difficulty
    );
    await storage.saveSession(nextSession);
    battery.currentSessionId = nextSession.sessionId;
    saveBatteriesToDisk();

    const nextBrief = BlackBoxSimulator.getBrief(nextSession);

    return {
      status: 'LEVEL_CLEARED',
      message: `Level ${battery.currentLevel - 1} Cleared with ${finishResult.score.total}/1000 pts! Auto-loading Level ${battery.currentLevel}...`,
      cleared_level: battery.currentLevel - 1,
      cleared_score: finishResult.score,
      next_level: battery.currentLevel,
      total_levels: 8,
      next_problem_name: nextLevelConfig.name,
      next_difficulty: nextLevelConfig.difficulty,
      new_session_id: nextSession.sessionId,
      brief: nextBrief,
    };
  }
}
