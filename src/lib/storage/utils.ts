import { SessionData } from '../engine/types';
import { LeaderboardEntry } from './types';

export function formatLeaderboardEntries(sessions: SessionData[]): LeaderboardEntry[] {
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

    const archMeta: Record<string, { name: string; domain: string; badge: string }> = {
      POISON_PILL_PANIC: { name: 'Poison Pill Panic', domain: 'Queue', badge: 'bg-purple-950/60 text-purple-300 border-purple-800/40' },
      LOST_UPDATE_CONCURRENCY: { name: 'Lost Update Concurrency', domain: 'Storage', badge: 'bg-blue-950/60 text-blue-300 border-blue-800/40' },
      TIMEOUT_POOL_STARVATION: { name: 'Timeout Starvation', domain: 'Network', badge: 'bg-amber-950/60 text-amber-300 border-amber-800/40' },
      AUTH_TOKEN_ROTATION_DESYNC: { name: 'Token Rotation Desync', domain: 'Ops', badge: 'bg-emerald-950/60 text-emerald-300 border-emerald-800/40' },
    };
    const info = archMeta[s.archetypeId] || { name: 'Custom Drill', domain: 'Incident', badge: 'bg-zinc-800 text-zinc-300 border-zinc-700' };

    return {
      sessionId: s.sessionId,
      modelName: s.modelName,
      seed: s.seed,
      archetypeId: isLadder ? 'LADDER' : info.domain.toUpperCase(),
      domain: info.domain,
      scenarioName: info.name,
      badgeColor: info.badge,
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
