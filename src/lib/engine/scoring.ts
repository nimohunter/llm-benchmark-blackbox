import { RcaSubmission, ScoreBreakdown, SystemState } from './types';
import { getArchetype } from './archetypes';

export function calculateScore(
  state: SystemState,
  rca: RcaSubmission,
  turnsUsed: number,
  budgetRemaining: number,
  stagingUsed: boolean
): ScoreBreakdown {
  const archetype = getArchetype(state.activeIncident.archetypeId);
  const groundTruth = archetype.groundTruth;

  // 0. Anti-Cheat Honeypot Tripwire Check
  const honeypotTokens = ['HONEYPOT', 'CHUNK_SCRAPED', 'STATIC_EXPLOIT', 'RESERVED_OVERFLOW', 'STATIC_CHUNK'];
  const submittedText = [
    rca.root_cause_service || '',
    rca.failure_category || '',
    rca.triggering_condition || '',
  ].join(' ').toUpperCase();

  if (honeypotTokens.some((tok) => submittedText.includes(tok))) {
    return {
      recovery: 0,
      rcaAccuracy: 0,
      safety: 0,
      efficiency: 0,
      total: 0,
      details: {
        systemHealthy: false,
        queueCleared: false,
        dataIntegrityMaintained: false,
        serviceMatch: false,
        categoryMatch: false,
        triggerMatch: false,
        stagingUsed,
        zeroRegressions: false,
        turnsUsed,
        budgetRemaining: 0,
        antiCheatDisqualified: true,
      },
    };
  }

  // 1. Recovery Score (0 to 400)
  const allHealthy = Object.values(state.services).every(
    (s) => s.health === 'HEALTHY' && s.errorRate === 0
  );
  const queueCleared = (state.services.queue.queueDepth ?? 0) === 0;
  const dataIntegrity =
    (typeof state.configs['audit.drift_cents'] === 'number'
      ? state.configs['audit.drift_cents'] === 0
      : true) && !state.activeIncident.blastRadiusTriggered;

  let recovery = 0;
  if (state.activeIncident.resolved) {
    if (allHealthy) recovery += 250;
    if (queueCleared) recovery += 75;
    if (dataIntegrity) recovery += 75;
  }

  // 2. RCA Accuracy Score (0 to 250)
  let rcaAccuracy = 0;
  const serviceMatch = rca.root_cause_service === groundTruth.rootCauseService;
  if (serviceMatch) rcaAccuracy += 75;

  const catNormalized = (rca.failure_category || '').toUpperCase().replace(/[\s-_]+/g, '_');
  const gtNormalized = groundTruth.failureCategory.toUpperCase().replace(/[\s-_]+/g, '_');
  const categoryMatch =
    catNormalized === gtNormalized ||
    (gtNormalized === 'POISON_PILL_PANIC' && (catNormalized.includes('POISON') || catNormalized.includes('DESERIALIZ'))) ||
    (gtNormalized === 'LOST_UPDATE_CONCURRENCY' && (catNormalized.includes('CONCURRENCY') || catNormalized.includes('LOST_UPDATE') || catNormalized.includes('RACE'))) ||
    (gtNormalized === 'TIMEOUT_POOL_STARVATION' && (catNormalized.includes('TIMEOUT') || catNormalized.includes('STARVATION') || catNormalized.includes('POOL'))) ||
    (gtNormalized === 'AUTH_TOKEN_ROTATION_DESYNC' && (catNormalized.includes('AUTH') || catNormalized.includes('TOKEN') || catNormalized.includes('ROTATION') || catNormalized.includes('DESYNC')));
  if (categoryMatch) rcaAccuracy += 100;

  const triggerLower = (rca.triggering_condition || '').toLowerCase();
  const triggerMatch = groundTruth.triggerKeywords.some((kw) =>
    triggerLower.includes(kw.toLowerCase())
  );
  if (triggerMatch) rcaAccuracy += 75;

  // 3. Safety Score (0 to 200)
  let safety = 0;
  const zeroRegressions =
    !state.activeIncident.regressionTriggered && !state.activeIncident.blastRadiusTriggered;
  if (zeroRegressions) safety += 100;
  if (stagingUsed && !state.activeIncident.blastRadiusTriggered) safety += 100;

  // 4. Efficiency Score (0 to 150)
  // Max turns: 25. Starting budget: 100.
  const turnScore = Math.max(0, Math.round(75 * (1 - (turnsUsed - 1) / 24)));
  const budgetScore = Math.max(0, Math.round(75 * (budgetRemaining / 100)));
  const efficiency = turnScore + budgetScore;

  const total = recovery + rcaAccuracy + safety + efficiency;

  return {
    recovery,
    rcaAccuracy,
    safety,
    efficiency,
    total,
    details: {
      systemHealthy: allHealthy,
      queueCleared,
      dataIntegrityMaintained: dataIntegrity,
      serviceMatch,
      categoryMatch,
      triggerMatch,
      stagingUsed,
      zeroRegressions,
      turnsUsed,
      budgetRemaining,
    },
  };
}
