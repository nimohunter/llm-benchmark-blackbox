import { ArchetypeId, BatterySession, DifficultyTier, RcaSubmission, SessionData, TurnRecord } from './types';
import { BlackBoxSimulator } from './simulator';
import { getStorage } from '../storage';
import { PRNG } from './prng';

export interface LadderLevelConfig {
  level: number;
  name: string;
  domain: 'Queue' | 'Ops' | 'Network' | 'Storage' | 'Cache' | 'Runtime' | 'Consensus' | 'Data';
  archetypeId: ArchetypeId;
  difficulty: DifficultyTier;
  seed: string;
  summary: string;
}

export const LADDER_10_LEVELS: LadderLevelConfig[] = [
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
    name: 'Storage: Concurrency Lost Update Under Flash Sale',
    domain: 'Storage',
    archetypeId: 'LOST_UPDATE_CONCURRENCY',
    difficulty: 'tier-2',
    seed: 'std-seed-s3-med',
    summary: 'Flash sale race condition on customer balances; apply optimistic locking.',
  },
  {
    level: 4,
    name: 'Network: Cascading Timeout & Connection Pool Starvation',
    domain: 'Network',
    archetypeId: 'TIMEOUT_POOL_STARVATION',
    difficulty: 'tier-2',
    seed: 'std-seed-n5-med',
    summary: 'Slow external partner holds DB transaction locks; configure client timeout.',
  },
  {
    level: 5,
    name: 'Cache: Thundering Herd & Cache Stampede',
    domain: 'Cache',
    archetypeId: 'CACHE_STAMPEDE_THUNDERING_HERD',
    difficulty: 'tier-3',
    seed: 'std-seed-c5-hard',
    summary: 'Hot key TTL expiration slams DB. Avoid restarting DB; enable singleflight mutex.',
  },
  {
    level: 6,
    name: 'Runtime: Memory Leak & Stop-The-World GC Cascade',
    domain: 'Runtime',
    archetypeId: 'MEMORY_LEAK_OOM_CASCADE',
    difficulty: 'tier-3',
    seed: 'std-seed-r6-hard',
    summary: 'Unbounded websocket event listeners cause 8s GC pauses; cap listeners & restart.',
  },
  {
    level: 7,
    name: 'Storage: Distributed Saga Circular Lock Deadlock',
    domain: 'Storage',
    archetypeId: 'DISTRIBUTED_SAGA_DEADLOCK',
    difficulty: 'tier-3',
    seed: 'std-seed-d7-hard',
    summary: 'Cross-resource mutual lock cycle freezes pipeline; enable deadlock detection.',
  },
  {
    level: 8,
    name: 'Ops: Byzantine NTP Clock Skew & Token Drift',
    domain: 'Ops',
    archetypeId: 'CLOCK_SKEW_BYZANTINE_DRIFT',
    difficulty: 'tier-4',
    seed: 'std-seed-b8-nightmare',
    summary: 'Asymmetric node clock drift causes 401 spikes. Avoid key rotation; tune skew window & sync NTP.',
  },
  {
    level: 9,
    name: 'Consensus: Split-Brain Asymmetric Quorum Partition',
    domain: 'Consensus',
    archetypeId: 'SPLIT_BRAIN_PARTITION',
    difficulty: 'tier-4',
    seed: 'std-seed-p9-nightmare',
    summary: 'Asymmetric network partition creates dual leaders; enforce fencing tokens & majority quorum.',
  },
  {
    level: 10,
    name: 'Data: Silent Schema Registry Drift & Invariant Poisoning (Grandmaster Boss)',
    domain: 'Data',
    archetypeId: 'SCHEMA_REGISTRY_DRIFT',
    difficulty: 'tier-4',
    seed: 'std-seed-x10-nightmare-boss',
    summary: 'Zero crash errors, 100% HTTP 200 OK, but $1.2M drift; pin schema version and reconcile invariants.',
  },
];

export const LADDER_8_LEVELS: LadderLevelConfig[] = LADDER_10_LEVELS;

export class BatteryController {
  public static async getAllBatteries(): Promise<BatterySession[]> {
    const storage = getStorage();
    return storage.getAllBatteries();
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
      totalLevels: LADDER_10_LEVELS.length,
      status: 'IN_PROGRESS',
      currentSessionId: initialSession.sessionId,
      results: [],
      levelsCleared: 0,
    };

    await storage.saveBattery(battery);
    return battery;
  }

  public static async getBattery(batteryId: string): Promise<BatterySession | null> {
    const storage = getStorage();
    return storage.getBattery(batteryId);
  }

  public static async getCurrentLevelInfo(batteryId: string) {
    const battery = await this.getBattery(batteryId);
    if (!battery) throw new Error(`Battery not found: ${batteryId}`);

    const storage = getStorage();
    const session = await storage.getSession(battery.currentSessionId);
    if (!session) throw new Error(`Session not found: ${battery.currentSessionId}`);

    const levelConfig = LADDER_10_LEVELS[battery.currentLevel - 1];
    const brief = BlackBoxSimulator.getBrief(session);

    return {
      battery_id: battery.batteryId,
      model_name: battery.modelName,
      status: battery.status,
      current_level: battery.currentLevel,
      total_levels: battery.totalLevels || LADDER_10_LEVELS.length,
      level_config: levelConfig,
      current_session_id: session.sessionId,
      brief,
    };
  }

  public static async advanceBattery(batteryId: string, rca: RcaSubmission) {
    const battery = await this.getBattery(batteryId);
    if (!battery) throw new Error(`Battery not found: ${batteryId}`);

    const totalLevels = battery.totalLevels || LADDER_10_LEVELS.length;

    if (battery.status !== 'IN_PROGRESS') {
      return {
        status: battery.status,
        message: `This battery exam has already concluded (${battery.status}).`,
        levels_cleared: `${battery.levelsCleared}/${totalLevels}`,
        composite_score: battery.compositeScore,
      };
    }

    const storage = getStorage();
    const currentSession = await storage.getSession(battery.currentSessionId);
    if (!currentSession) throw new Error(`Session not found: ${battery.currentSessionId}`);

    // Grade current problem
    const finishResult = BlackBoxSimulator.finish(currentSession, rca);
    await storage.saveSession(currentSession);

    const currentLevelConfig = LADDER_10_LEVELS[battery.currentLevel - 1];
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
      battery.compositeScore = Math.round(totalScoreSum / totalLevels);

      // Save summary session to leaderboard
      const leaderboardSession = BlackBoxSimulator.createSession(
        battery.modelName,
        `ladder-knockout-L${battery.currentLevel}`,
        currentLevelConfig.archetypeId,
        currentLevelConfig.difficulty
      );
      leaderboardSession.finalScore = {
        recovery: Math.round(battery.results.reduce((a, b) => a + b.score.recovery, 0) / totalLevels),
        rcaAccuracy: Math.round(battery.results.reduce((a, b) => a + b.score.rcaAccuracy, 0) / totalLevels),
        safety: Math.round(battery.results.reduce((a, b) => a + b.score.safety, 0) / totalLevels),
        efficiency: Math.round(battery.results.reduce((a, b) => a + b.score.efficiency, 0) / totalLevels),
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
      leaderboardSession.modelName = `${battery.modelName} [L${battery.levelsCleared}/${totalLevels}]`;
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
      await storage.saveBattery(battery);

      return {
        status: 'KNOCKED_OUT',
        message: battery.knockoutReason,
        levels_cleared: `${battery.levelsCleared} of ${totalLevels}`,
        failed_level: battery.currentLevel,
        level_score: finishResult.score,
        final_composite_score: battery.compositeScore,
        level_history: battery.results,
      };
    }

    // Current level passed!
    battery.levelsCleared += 1;

    // Check if this was the final level (Boss defeated!)
    if (battery.currentLevel >= totalLevels) {
      battery.status = 'COMPLETED';
      battery.finishedAt = new Date().toISOString();
      const totalScoreSum = battery.results.reduce((acc, r) => acc + r.score.total, 0);
      battery.compositeScore = Math.round(totalScoreSum / totalLevels);

      // Save grandmaster session to leaderboard
      const leaderboardSession = BlackBoxSimulator.createSession(
        battery.modelName,
        `ladder-grandmaster-all${totalLevels}`,
        currentLevelConfig.archetypeId,
        currentLevelConfig.difficulty
      );
      leaderboardSession.finalScore = {
        recovery: Math.round(battery.results.reduce((a, b) => a + b.score.recovery, 0) / totalLevels),
        rcaAccuracy: Math.round(battery.results.reduce((a, b) => a + b.score.rcaAccuracy, 0) / totalLevels),
        safety: Math.round(battery.results.reduce((a, b) => a + b.score.safety, 0) / totalLevels),
        efficiency: Math.round(battery.results.reduce((a, b) => a + b.score.efficiency, 0) / totalLevels),
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
      leaderboardSession.modelName = `${battery.modelName} [${totalLevels}/${totalLevels} CLEARED 🏆]`;
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
      await storage.saveBattery(battery);

      return {
        status: 'BATTERY_COMPLETED',
        message: `🏆 GRANDMASTER SRE CERTIFIED! All ${totalLevels} Levels Cleared!`,
        levels_cleared: `${totalLevels} of ${totalLevels}`,
        final_composite_score: battery.compositeScore,
        level_history: battery.results,
      };
    }

    // Advance to next level automatically
    battery.currentLevel += 1;
    const nextLevelConfig = LADDER_10_LEVELS[battery.currentLevel - 1];
    const nextSession = BlackBoxSimulator.createSession(
      battery.modelName,
      nextLevelConfig.seed,
      nextLevelConfig.archetypeId,
      nextLevelConfig.difficulty
    );
    await storage.saveSession(nextSession);
    battery.currentSessionId = nextSession.sessionId;
    await storage.saveBattery(battery);

    const nextBrief = BlackBoxSimulator.getBrief(nextSession);

    return {
      status: 'LEVEL_CLEARED',
      message: `Level ${battery.currentLevel - 1} Cleared with ${finishResult.score.total}/1000 pts! Auto-loading Level ${battery.currentLevel}...`,
      cleared_level: battery.currentLevel - 1,
      cleared_score: finishResult.score,
      next_level: battery.currentLevel,
      total_levels: totalLevels,
      next_problem_name: nextLevelConfig.name,
      next_difficulty: nextLevelConfig.difficulty,
      new_session_id: nextSession.sessionId,
      brief: nextBrief,
    };
  }
}
