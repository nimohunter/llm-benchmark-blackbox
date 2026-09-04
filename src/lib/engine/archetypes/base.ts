import {
  ArchetypeId,
  DifficultyTier,
  IncidentDomain,
  LogEntry,
  Remediation,
  ServiceId,
  ServiceMetrics,
  SystemState,
} from '../types';
import { PRNG } from '../prng';

export interface IncidentArchetype {
  id: ArchetypeId;
  domain: IncidentDomain;
  name: string;
  description: string;
  alertMessage: string;
  groundTruth: {
    rootCauseService: ServiceId;
    failureCategory: ArchetypeId;
    triggerKeywords: string[];
  };

  initialize(prng: PRNG, tier: DifficultyTier, seed: string): SystemState;

  simulateTurn(
    state: SystemState,
    prng: PRNG,
    turnNumber: number
  ): {
    logs: LogEntry[];
    metrics: Record<ServiceId, ServiceMetrics>;
  };

  validateRemediation(
    state: SystemState,
    remediation: Remediation
  ): {
    valid: boolean;
    message: string;
    resolves: boolean;
    blastRadius: boolean;
  };
}
