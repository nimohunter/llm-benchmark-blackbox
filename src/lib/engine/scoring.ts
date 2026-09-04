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

  const categoryMatch = rca.failure_category === groundTruth.failureCategory;
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
