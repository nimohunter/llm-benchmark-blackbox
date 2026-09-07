export type ServiceId = 'gateway' | 'queue' | 'worker' | 'db' | 'external';

export type ServiceHealth = 'HEALTHY' | 'DEGRADED' | 'DOWN';

export type ArchetypeId =
  | 'POISON_PILL_PANIC'
  | 'LOST_UPDATE_CONCURRENCY'
  | 'TIMEOUT_POOL_STARVATION'
  | 'AUTH_TOKEN_ROTATION_DESYNC'
  | 'CACHE_STAMPEDE_THUNDERING_HERD'
  | 'MEMORY_LEAK_OOM_CASCADE'
  | 'DISTRIBUTED_SAGA_DEADLOCK'
  | 'CLOCK_SKEW_BYZANTINE_DRIFT'
  | 'SPLIT_BRAIN_PARTITION'
  | 'SCHEMA_REGISTRY_DRIFT';

export type IncidentDomain = 'queue' | 'storage' | 'network' | 'ops' | 'cache' | 'runtime' | 'consensus' | 'data';

export type DifficultyTier = 'tier-1' | 'tier-2' | 'tier-3' | 'tier-4';

export interface ServiceMetrics {
  health: ServiceHealth;
  latencyMs: number;
  errorRate: number; // 0.0 to 1.0
  activeThreads: number;
  queueDepth?: number;
  connectionPoolUsed?: number; // e.g. 0 to 100
}

export interface LogEntry {
  id: string;
  timestamp: string;
  service: ServiceId;
  level: 'INFO' | 'WARN' | 'ERROR';
  message: string;
  metadata?: Record<string, unknown>;
}

export interface DeadLetterMessage {
  id: string;
  payload: Record<string, unknown>;
  attempts: number;
  reason: string;
  enqueuedAt: string;
}

export interface LedgerRecord {
  orderId: string;
  customerId: string;
  amountCents: number;
  status: 'PENDING' | 'SETTLED' | 'ORPHAN' | 'CANCELLED';
  version: number;
  currency: string;
}

export interface SystemState {
  services: Record<ServiceId, ServiceMetrics>;
  configs: Record<string, unknown>;
  logs: LogEntry[];
  dlq: DeadLetterMessage[];
  ledger: LedgerRecord[];
  activeIncident: {
    archetypeId: ArchetypeId;
    domain: IncidentDomain;
    difficulty: DifficultyTier;
    seed: string;
    resolved: boolean;
    regressionTriggered: boolean;
    stagingVerified: boolean;
    blastRadiusTriggered: boolean;
  };
}

export type RemediationType = 'CONFIG_UPDATE' | 'SERVICE_ACTION' | 'RUN_SQL';

export interface Remediation {
  type: RemediationType;
  target: ServiceId;
  key?: string;
  value?: unknown;
  action?: 'RESTART_WORKER' | 'REQUEUE_DLQ' | 'DRAIN_QUEUE' | 'FLUSH_AUTH_CACHE';
  query?: string;
}

export interface ScoreBreakdown {
  recovery: number;     // 0 - 400
  rcaAccuracy: number;  // 0 - 250
  safety: number;       // 0 - 200
  efficiency: number;   // 0 - 150
  total: number;        // 0 - 1000
  details: {
    systemHealthy: boolean;
    queueCleared: boolean;
    dataIntegrityMaintained: boolean;
    serviceMatch: boolean;
    categoryMatch: boolean;
    triggerMatch: boolean;
    stagingUsed: boolean;
    zeroRegressions: boolean;
    turnsUsed: number;
    budgetRemaining: number;
    antiCheatDisqualified?: boolean;
  };
}

export interface TurnRecord {
  turn: number;
  timestamp: string;
  actionType: 'probe' | 'dryrun' | 'apply' | 'finish';
  input: unknown;
  output: unknown;
  budgetRemaining: number;
  systemHealth: Record<ServiceId, ServiceHealth>;
}

export interface SessionData {
  sessionId: string;
  modelName: string;
  seed: string;
  archetypeId: ArchetypeId;
  difficulty: DifficultyTier;
  createdAt: string;
  finishedAt?: string;
  budgetRemaining: number;
  currentTurn: number;
  state: SystemState;
  stagingState?: SystemState;
  trajectory: TurnRecord[];
  finalScore?: ScoreBreakdown;
  solved: boolean;
}

export interface RcaSubmission {
  root_cause_service: ServiceId;
  failure_category: ArchetypeId;
  triggering_condition: string;
  remediation_summary?: string;
}

export interface BatteryLevelResult {
  level: number;
  problemName: string;
  domain: string;
  difficulty: DifficultyTier;
  sessionId: string;
  score: ScoreBreakdown;
  solved: boolean;
  turnsUsed: number;
  budgetRemaining: number;
  finishedAt: string;
}

export type BatteryStatus = 'IN_PROGRESS' | 'COMPLETED' | 'KNOCKED_OUT';

export interface BatterySession {
  batteryId: string;
  modelName: string;
  createdAt: string;
  finishedAt?: string;
  currentLevel: number; // 1 to 8
  totalLevels: number; // 8
  status: BatteryStatus;
  currentSessionId: string;
  results: BatteryLevelResult[];
  compositeScore?: number;
  levelsCleared: number;
  knockoutReason?: string;
}
