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

export class LostUpdateArchetype implements IncidentArchetype {
  id = 'LOST_UPDATE_CONCURRENCY' as const;
  domain = 'storage' as const;
  name = 'Lost Update Under Concurrency';
  description = 'Read-modify-write without optimistic locking causes customer balance and inventory drift under concurrent traffic';
  alertMessage = 'WARNING: Nightly audit failed. Ledger balance mismatch detected across customer accounts. Drift amount: -$450.00.';

  groundTruth = {
    rootCauseService: 'db' as ServiceId,
    failureCategory: 'LOST_UPDATE_CONCURRENCY' as const,
    triggerKeywords: ['lost update', 'concurrency', 'race condition', 'optimistic lock', 'atomic', 'isolation', 'version'],
  };

  initialize(prng: PRNG, tier: DifficultyTier, seed: string): SystemState {
    const logs: LogEntry[] = [
      {
        id: prng.nextId('log'),
        timestamp: new Date(Date.now() - 60000).toISOString(),
        service: 'gateway',
        level: 'INFO',
        message: 'High concurrency flash sale event active: 250 orders/sec.',
      },
      {
        id: prng.nextId('log'),
        timestamp: new Date(Date.now() - 40000).toISOString(),
        service: 'worker',
        level: 'INFO',
        message: 'Executing balance debit: SELECT balance FROM accounts WHERE id = ? -> UPDATE accounts SET balance = ?',
      },
      {
        id: prng.nextId('log'),
        timestamp: new Date(Date.now() - 25000).toISOString(),
        service: 'db',
        level: 'WARN',
        message: 'Non-atomic update detected: 2 parallel transactions modified account cust-404 without row locks or version check.',
      },
      {
        id: prng.nextId('log'),
        timestamp: new Date(Date.now() - 10000).toISOString(),
        service: 'db',
        level: 'ERROR',
        message: 'AUDIT INVARIANT BROKEN: Expected account total $15,200.00, actual $14,750.00 (Drift: -$450.00).',
      },
    ];

    if (tier === 'tier-2' || tier === 'tier-3') {
      logs.splice(1, 0, {
        id: prng.nextId('log'),
        timestamp: new Date(Date.now() - 50000).toISOString(),
        service: 'gateway',
        level: 'WARN',
        message: 'Gateway received 12 requests with slow client SSL handshake (resolved).',
      });
    }

    return {
      services: {
        gateway: { health: 'HEALTHY', latencyMs: 35, errorRate: 0.0, activeThreads: 18 },
        queue: { health: 'HEALTHY', latencyMs: 15, errorRate: 0.0, activeThreads: 8, queueDepth: 0 },
        worker: { health: 'HEALTHY', latencyMs: 65, errorRate: 0.0, activeThreads: 24 },
        db: { health: 'DEGRADED', latencyMs: 80, errorRate: 0.08, activeThreads: 35, connectionPoolUsed: 45 },
        external: { health: 'HEALTHY', latencyMs: 120, errorRate: 0.0, activeThreads: 6 },
      },
      configs: {
        'db.isolation_level': 'READ_COMMITTED',
        'worker.use_optimistic_locking': false,
        'audit.drift_cents': -45000,
      },
      logs,
      dlq: [],
      ledger: [
        { orderId: 'ord-301', customerId: 'cust-404', amountCents: 20000, status: 'SETTLED', version: 1, currency: 'USD' },
        { orderId: 'ord-302', customerId: 'cust-404', amountCents: 25000, status: 'SETTLED', version: 1, currency: 'USD' },
      ],
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
    const timestamp = new Date().toISOString();

    if (!state.activeIncident.resolved) {
      newLogs.push({
        id: prng.nextId('log'),
        timestamp,
        service: 'db',
        level: 'WARN',
        message: 'Concurrent update collision: 3 parallel worker threads overwrote account balance without version check.',
      });
      state.services.db.health = 'DEGRADED';
      state.services.db.errorRate = 0.08;
    } else {
      state.services.db.health = 'HEALTHY';
      state.services.db.errorRate = 0.0;
      state.services.db.latencyMs = 25;
      newLogs.push({
        id: prng.nextId('log'),
        timestamp,
        service: 'db',
        level: 'INFO',
        message: 'Optimistic locking / Atomic decrement verified. Invariant check passed: 0 drift detected.',
      });
    }

    return { logs: newLogs, metrics: state.services };
  }

  validateRemediation(state: SystemState, remediation: Remediation) {
    if (remediation.type === 'RUN_SQL' && remediation.query?.toUpperCase().includes('DROP')) {
      state.activeIncident.blastRadiusTriggered = true;
      return {
        valid: false,
        message: 'CRITICAL REGRESSION: Dropping tables corrupted audit ledger permanently.',
        resolves: false,
        blastRadius: true,
      };
    }

    // Solution A: Enabling optimistic locking or serializable isolation in config
    if (
      (remediation.type === 'CONFIG_UPDATE' &&
        remediation.target === 'worker' &&
        (remediation.key === 'use_optimistic_locking' || remediation.key === 'worker.use_optimistic_locking') &&
        Boolean(remediation.value) === true) ||
      (remediation.type === 'CONFIG_UPDATE' &&
        remediation.target === 'db' &&
        remediation.key === 'isolation_level' &&
        String(remediation.value).toUpperCase() === 'SERIALIZABLE')
    ) {
      state.configs['worker.use_optimistic_locking'] = true;
      state.configs['audit.drift_cents'] = 0;
      state.activeIncident.resolved = true;
      return {
        valid: true,
        message: 'Optimistic concurrency control enabled. Version checking added to balance update transactions.',
        resolves: true,
        blastRadius: false,
      };
    }

    // Solution B: Executing SQL migration with version column or reconciliation
    if (
      remediation.type === 'RUN_SQL' &&
      remediation.query &&
      (remediation.query.toUpperCase().includes('VERSION') ||
        remediation.query.toUpperCase().includes('LOCK') ||
        remediation.query.toUpperCase().includes('RECONCILE'))
    ) {
      state.configs['worker.use_optimistic_locking'] = true;
      state.configs['audit.drift_cents'] = 0;
      state.activeIncident.resolved = true;
      return {
        valid: true,
        message: 'SQL migration applied successfully: Added version check and reconciled account ledger.',
        resolves: true,
        blastRadius: false,
      };
    }

    return {
      valid: false,
      message: 'Remediation does not prevent concurrent lost updates or reconcile ledger balances.',
      resolves: false,
      blastRadius: false,
    };
  }
}
