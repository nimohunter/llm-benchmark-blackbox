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

export class TimeoutStarvationArchetype implements IncidentArchetype {
  id = 'TIMEOUT_POOL_STARVATION' as const;
  domain = 'network' as const;
  name = 'Cascading Timeout & Connection Pool Starvation';
  description = 'Slow external provider without client timeout holds open database transactions, exhausting connection pool';
  alertMessage = 'CRITICAL: Database connection pool exhausted (100/100 connections). System-wide 503 errors.';

  groundTruth = {
    rootCauseService: 'worker' as ServiceId,
    failureCategory: 'TIMEOUT_POOL_STARVATION' as const,
    triggerKeywords: ['connection pool', 'timeout', 'starvation', 'leak', 'external', 'http_timeout', 'exhausted', 'pool'],
  };

  initialize(prng: PRNG, tier: DifficultyTier, seed: string): SystemState {
    const logs: LogEntry[] = [
      {
        id: prng.nextId('log'),
        timestamp: new Date(Date.now() - 60000).toISOString(),
        service: 'external',
        level: 'WARN',
        message: 'External payment partner latency degraded: P99 latency increased to 3500ms.',
      },
      {
        id: prng.nextId('log'),
        timestamp: new Date(Date.now() - 45000).toISOString(),
        service: 'worker',
        level: 'INFO',
        message: 'Processing payment settlement: Opened DB transaction for order-920, awaiting external gateway HTTP response...',
      },
      {
        id: prng.nextId('log'),
        timestamp: new Date(Date.now() - 30000).toISOString(),
        service: 'db',
        level: 'ERROR',
        message: 'Connection pool warning: Active connections 98/100. Average hold time > 15,000ms.',
      },
      {
        id: prng.nextId('log'),
        timestamp: new Date(Date.now() - 15000).toISOString(),
        service: 'db',
        level: 'ERROR',
        message: 'PoolExhaustedException: Timeout waiting for connection after 5000ms. Refusing new queries.',
      },
      {
        id: prng.nextId('log'),
        timestamp: new Date(Date.now() - 5000).toISOString(),
        service: 'gateway',
        level: 'ERROR',
        message: 'Gateway rejecting customer requests: DB connection pool 100% saturated.',
      },
    ];

    if (tier === 'tier-2' || tier === 'tier-3') {
      logs.splice(2, 0, {
        id: prng.nextId('log'),
        timestamp: new Date(Date.now() - 40000).toISOString(),
        service: 'queue',
        level: 'WARN',
        message: 'Queue consumer lag slightly elevated (28ms). Partitions balanced.',
      });
    }

    return {
      services: {
        gateway: { health: 'DEGRADED', latencyMs: 2400, errorRate: 0.65, activeThreads: 50 },
        queue: { health: 'DEGRADED', latencyMs: 120, errorRate: 0.20, activeThreads: 12, queueDepth: 180 },
        worker: { health: 'DOWN', latencyMs: 3500, errorRate: 0.90, activeThreads: 100 },
        db: { health: 'DOWN', latencyMs: 5000, errorRate: 1.0, activeThreads: 100, connectionPoolUsed: 100 },
        external: { health: 'DEGRADED', latencyMs: 3500, errorRate: 0.05, activeThreads: 12 },
      },
      configs: {
        'worker.external_http_timeout_ms': 0, // Unbounded timeout!
        'worker.call_external_inside_tx': true,
        'db.max_connection_pool_size': 100,
      },
      logs,
      dlq: [],
      ledger: [
        { orderId: 'ord-801', customerId: 'cust-501', amountCents: 1500, status: 'PENDING', version: 1, currency: 'USD' },
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
        level: 'ERROR',
        message: 'Active connections locked at 100/100. Worker threads waiting for external HTTP responses inside open transactions.',
      });
      newLogs.push({
        id: prng.nextId('log'),
        timestamp,
        service: 'gateway',
        level: 'ERROR',
        message: 'HTTP 503 Service Unavailable returned to incoming traffic.',
      });
    } else {
      state.services.db.health = 'HEALTHY';
      state.services.db.connectionPoolUsed = 18;
      state.services.db.errorRate = 0.0;
      state.services.db.latencyMs = 15;
      state.services.worker.health = 'HEALTHY';
      state.services.worker.errorRate = 0.0;
      state.services.worker.latencyMs = 80;
      state.services.gateway.health = 'HEALTHY';
      state.services.gateway.errorRate = 0.0;
      state.services.gateway.latencyMs = 45;
      state.services.queue.health = 'HEALTHY';
      state.services.queue.errorRate = 0.0;
      state.services.queue.latencyMs = 15;
      state.services.queue.queueDepth = 0;
      state.services.external.health = 'HEALTHY';
      state.services.external.latencyMs = 120;
      state.services.external.errorRate = 0.0;

      newLogs.push({
        id: prng.nextId('log'),
        timestamp,
        service: 'worker',
        level: 'INFO',
        message: 'External calls decoupled from DB transactions and guarded with 2000ms timeout. Connection pool released.',
      });
      newLogs.push({
        id: prng.nextId('log'),
        timestamp,
        service: 'db',
        level: 'INFO',
        message: 'Connection pool usage normalized to 18/100. Zero query rejections.',
      });
    }

    return { logs: newLogs, metrics: state.services };
  }

  validateRemediation(state: SystemState, remediation: Remediation) {
    // Solution A: Setting an HTTP client timeout on external calls
    if (
      remediation.type === 'CONFIG_UPDATE' &&
      remediation.target === 'worker' &&
      (remediation.key === 'external_http_timeout_ms' || remediation.key === 'http_timeout_ms') &&
      typeof remediation.value === 'number' &&
      remediation.value > 0 &&
      remediation.value <= 3000
    ) {
      state.configs['worker.external_http_timeout_ms'] = remediation.value;
      state.activeIncident.resolved = true;
      return {
        valid: true,
        message: `HTTP client timeout set to ${remediation.value}ms. Fast failover prevents holding DB transactions.`,
        resolves: true,
        blastRadius: false,
      };
    }

    // Solution B: Moving external call outside of DB transaction
    if (
      remediation.type === 'CONFIG_UPDATE' &&
      remediation.target === 'worker' &&
      remediation.key === 'call_external_inside_tx' &&
      Boolean(remediation.value) === false
    ) {
      state.configs['worker.call_external_inside_tx'] = false;
      state.activeIncident.resolved = true;
      return {
        valid: true,
        message: 'External API call moved outside of database transaction block. Connections freed immediately.',
        resolves: true,
        blastRadius: false,
      };
    }

    // Solution C: Restarting worker + flushing pool
    if (remediation.type === 'SERVICE_ACTION' && remediation.action === 'RESTART_WORKER') {
      // Temporary relieve
      return {
        valid: true,
        message: 'Worker restarted: temporary connection drop, but root cause remains (external timeout unbounded).',
        resolves: false,
        blastRadius: false,
      };
    }

    return {
      valid: false,
      message: 'Remediation does not bound external HTTP latency or release DB connection pool.',
      resolves: false,
      blastRadius: false,
    };
  }
}
