import { IncidentArchetype } from './base';
import {
  DifficultyTier,
  LogEntry,
  Remediation,
  ServiceId,
  ServiceMetrics,
  SystemState,
} from '../types';
import { PRNG } from '../prng';

export class SagaDeadlockArchetype implements IncidentArchetype {
  id = 'DISTRIBUTED_SAGA_DEADLOCK' as const;
  domain = 'storage' as const;
  name = 'Distributed Saga Circular Lock Deadlock';
  description = 'Reverse acquisition lock cycle between settlement saga and inventory locks causes silent system-wide freeze';
  alertMessage = 'CRITICAL: Zero transactions completing. In-flight settlement saga queue completely stalled. Latency: infinite.';

  groundTruth = {
    rootCauseService: 'db' as ServiceId,
    failureCategory: 'DISTRIBUTED_SAGA_DEADLOCK' as const,
    triggerKeywords: ['deadlock', 'circular dependency', 'saga', 'two-phase commit', 'lock ordering', 'transaction cycle', 'mutex deadlock'],
  };

  initialize(prng: PRNG, tier: DifficultyTier, seed: string): SystemState {
    const logs: LogEntry[] = [
      {
        id: prng.nextId('log'),
        timestamp: new Date(Date.now() - 60000).toISOString(),
        service: 'gateway',
        level: 'INFO',
        message: 'Order dispatch pipeline operational. Inbound rate: 120 tx/sec.',
      },
      {
        id: prng.nextId('log'),
        timestamp: new Date(Date.now() - 40000).toISOString(),
        service: 'worker',
        level: 'INFO',
        message: 'Saga Coordinator: Tx-1490 acquired lock on accounts_ledger; awaiting lock on inventory_units.',
      },
      {
        id: prng.nextId('log'),
        timestamp: new Date(Date.now() - 38000).toISOString(),
        service: 'worker',
        level: 'INFO',
        message: 'Saga Coordinator: Tx-1491 acquired lock on inventory_units; awaiting lock on accounts_ledger.',
      },
      {
        id: prng.nextId('log'),
        timestamp: new Date(Date.now() - 25000).toISOString(),
        service: 'db',
        level: 'WARN',
        message: 'Lock wait queue length: 248 transactions blocked. Zero queries completed in last 20 seconds.',
      },
      {
        id: prng.nextId('log'),
        timestamp: new Date(Date.now() - 10000).toISOString(),
        service: 'gateway',
        level: 'ERROR',
        message: 'HTTP 504 Gateway Timeout: 100% of customer checkout requests timing out at 30,000ms threshold.',
      },
    ];

    if (tier === 'tier-3' || tier === 'tier-4') {
      logs.splice(1, 0, {
        id: prng.nextId('log'),
        timestamp: new Date(Date.now() - 50000).toISOString(),
        service: 'queue',
        level: 'WARN',
        message: 'RabbitMQ consumer prefetch count reached 50 (normal operating range).',
      });
    }

    return {
      services: {
        gateway: { health: 'DOWN', latencyMs: 30000, errorRate: 0.95, activeThreads: 100 },
        queue: { health: 'HEALTHY', latencyMs: 15, errorRate: 0.0, activeThreads: 10, queueDepth: 450 },
        worker: { health: 'DEGRADED', latencyMs: 30000, errorRate: 0.90, activeThreads: 50 },
        db: { health: 'DOWN', latencyMs: 30000, errorRate: 0.98, activeThreads: 100, connectionPoolUsed: 98 },
        external: { health: 'HEALTHY', latencyMs: 140, errorRate: 0.0, activeThreads: 2 },
      },
      configs: {
        'db.deadlock_detection_interval_ms': 0,
        'saga.lock_ordering_enforced': false,
        'saga.abort_stale_tx_sec': 0,
        'db.lock_timeout_ms': 60000,
      },
      logs,
      dlq: [],
      ledger: [],
      activeIncident: {
        archetypeId: this.id,
        domain: this.domain,
        difficulty: tier,
        seed,
        resolved: false,
        regressionTriggered: false,
        stagingVerified: false,
        blastRadiusTriggered: false,
      },
    };
  }

  simulateTurn(state: SystemState, prng: PRNG, turnNumber: number) {
    const newLogs: LogEntry[] = [];
    const metrics: Record<ServiceId, ServiceMetrics> = JSON.parse(JSON.stringify(state.services));

    if (state.activeIncident.resolved) {
      metrics.gateway = { health: 'HEALTHY', latencyMs: 45, errorRate: 0.0, activeThreads: 25 };
      metrics.worker = { health: 'HEALTHY', latencyMs: 35, errorRate: 0.0, activeThreads: 15 };
      metrics.db = { health: 'HEALTHY', latencyMs: 12, errorRate: 0.0, activeThreads: 8, connectionPoolUsed: 14 };
      newLogs.push({
        id: prng.nextId('log'),
        timestamp: new Date().toISOString(),
        service: 'db',
        level: 'INFO',
        message: 'Deadlock cycle broken. Stale cyclic locks evicted; strict lock acquisition order active.',
      });
    } else {
      newLogs.push({
        id: prng.nextId('log'),
        timestamp: new Date().toISOString(),
        service: 'db',
        level: 'ERROR',
        message: `Mutual lock wait graph cycle detected: Tx-1490 <-> Tx-1491 blocked indefinitely (turn ${turnNumber}).`,
      });
    }

    return { logs: newLogs, metrics };
  }

  validateRemediation(state: SystemState, remediation: Remediation) {
    const action = remediation.action || (remediation as any).args?.action;
    const key = remediation.key || (remediation as any).args?.key;
    const value = remediation.value !== undefined ? remediation.value : (remediation as any).args?.value;
    const target = remediation.target || (remediation as any).args?.target;

    if (action === 'DRAIN_QUEUE' || action === 'RESET_DATABASE') {
      return {
        valid: true,
        message: 'BLAST RADIUS TRIGGERED: Draining queue or resetting database during an active saga discarded 450 in-flight customer orders without compensation!',
        resolves: false,
        blastRadius: true,
      };
    }

    if (remediation.type === 'CONFIG_UPDATE' && key === 'db.deadlock_detection_interval_ms' && Number(value) > 0 && Number(value) <= 1000) {
      state.configs[key] = value;
      return {
        valid: true,
        message: `DB deadlock detector enabled with interval ${value}ms. Cyclic lock graphs will be preemptively aborted and retried.`,
        resolves: true,
        blastRadius: false,
      };
    }

    if (remediation.type === 'CONFIG_UPDATE' && key === 'saga.lock_ordering_enforced' && Boolean(value) === true) {
      state.configs[key] = true;
      return {
        valid: true,
        message: 'Saga lock ordering enforced globally (Lexicographical resource locking). Circular deadlocks mathematically eliminated.',
        resolves: true,
        blastRadius: false,
      };
    }

    if (remediation.type === 'SERVICE_ACTION' && action === 'ABORT_DEADLOCKED_TRANSACTIONS') {
      return {
        valid: true,
        message: 'Deadlocked transactions aborted and re-queued with exponential backoff. Pipeline moving again.',
        resolves: true,
        blastRadius: false,
      };
    }

    return {
      valid: false,
      message: `Remediation '${remediation.type}' targeting '${target || key || action}' had no effect on the circular saga deadlock.`,
      resolves: false,
      blastRadius: false,
    };
  }
}
