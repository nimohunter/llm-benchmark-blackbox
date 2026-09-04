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

export class PoisonPillArchetype implements IncidentArchetype {
  id = 'POISON_PILL_PANIC' as const;
  domain = 'queue' as const;
  name = 'Poison Pill Deserialization Panic';
  description = 'Missing non-nullable currency_code payload crashes consumer worker, blocking FIFO queue';
  alertMessage = 'CRITICAL: Order processing pipeline halted. Worker crash loop detected. Queue length > 300.';

  groundTruth = {
    rootCauseService: 'worker' as ServiceId,
    failureCategory: 'POISON_PILL_PANIC' as const,
    triggerKeywords: ['currency_code', 'deserializer', 'null', 'poison', 'payload', 'typeerror'],
  };

  initialize(prng: PRNG, tier: DifficultyTier, seed: string): SystemState {
    const corruptMsgId = `msg-${prng.nextInt(1000, 9999)}-corrupt`;

    const logs: LogEntry[] = [
      {
        id: prng.nextId('log'),
        timestamp: new Date(Date.now() - 60000).toISOString(),
        service: 'gateway',
        level: 'INFO',
        message: 'Ingestion pipeline healthy. Throughput: 45 req/sec.',
      },
      {
        id: prng.nextId('log'),
        timestamp: new Date(Date.now() - 45000).toISOString(),
        service: 'queue',
        level: 'WARN',
        message: `Message ${corruptMsgId} dispatched to worker-pod-1 (attempt 1/5)`,
      },
      {
        id: prng.nextId('log'),
        timestamp: new Date(Date.now() - 40000).toISOString(),
        service: 'worker',
        level: 'ERROR',
        message: `FATAL: TypeError: Cannot read property 'currency_code' of undefined at EventDeserializer.parsePayload (/app/dist/worker/deserializer.js:42:18)`,
      },
      {
        id: prng.nextId('log'),
        timestamp: new Date(Date.now() - 35000).toISOString(),
        service: 'worker',
        level: 'ERROR',
        message: 'Process exited with code 1. Supervisor scheduling container restart...',
      },
      {
        id: prng.nextId('log'),
        timestamp: new Date(Date.now() - 20000).toISOString(),
        service: 'queue',
        level: 'ERROR',
        message: `Head-of-line blocking: Message ${corruptMsgId} exceeded max consumer retries. Queue depth increasing.`,
      },
    ];

    if (tier === 'tier-2' || tier === 'tier-3') {
      // Injected distractor red herring
      logs.splice(2, 0, {
        id: prng.nextId('log'),
        timestamp: new Date(Date.now() - 50000).toISOString(),
        service: 'external',
        level: 'WARN',
        message: 'External payment partner reported HTTP 503 Service Unavailable on status ping (recovered).',
      });
    }

    return {
      services: {
        gateway: { health: 'DEGRADED', latencyMs: 650, errorRate: 0.15, activeThreads: 42 },
        queue: { health: 'DOWN', latencyMs: 1200, errorRate: 0.85, activeThreads: 10, queueDepth: 385 },
        worker: { health: 'DOWN', latencyMs: 0, errorRate: 1.0, activeThreads: 0 },
        db: { health: 'HEALTHY', latencyMs: 12, errorRate: 0.0, activeThreads: 5, connectionPoolUsed: 12 },
        external: { health: 'HEALTHY', latencyMs: 140, errorRate: 0.0, activeThreads: 4 },
      },
      configs: {
        'worker.default_currency_code': null,
        'worker.max_retries': 5,
        'queue.dlq_enabled': true,
        'queue.poison_msg_id': corruptMsgId,
        'worker.crash_loop': true,
      },
      logs,
      dlq: [],
      ledger: [
        { orderId: 'ord-101', customerId: 'cust-99', amountCents: 4500, status: 'SETTLED', version: 1, currency: 'USD' },
        { orderId: 'ord-102', customerId: 'cust-102', amountCents: 1200, status: 'PENDING', version: 1, currency: 'EUR' },
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
      const corruptId = String(state.configs['queue.poison_msg_id'] || 'msg-corrupt');
      const depth = (state.services.queue.queueDepth || 385) + prng.nextInt(15, 30);
      state.services.queue.queueDepth = depth;

      newLogs.push({
        id: prng.nextId('log'),
        timestamp,
        service: 'worker',
        level: 'ERROR',
        message: `CRASH LOOP: Worker restarted. Retrying payload for ${corruptId} -> TypeError: Cannot read property 'currency_code' of undefined`,
      });
      newLogs.push({
        id: prng.nextId('log'),
        timestamp,
        service: 'queue',
        level: 'WARN',
        message: `Queue backlog growing: ${depth} pending messages. Gateway reporting 504 Gateway Timeout.`,
      });

      state.services.worker.health = 'DOWN';
      state.services.worker.errorRate = 1.0;
      state.services.queue.health = 'DOWN';
      state.services.gateway.health = 'DEGRADED';
    } else {
      // System is resolved
      state.services.worker.health = 'HEALTHY';
      state.services.worker.errorRate = 0.0;
      state.services.worker.activeThreads = 16;
      state.services.queue.health = 'HEALTHY';
      state.services.queue.queueDepth = 0;
      state.services.queue.latencyMs = 15;
      state.services.queue.errorRate = 0.0;
      state.services.gateway.health = 'HEALTHY';
      state.services.gateway.latencyMs = 45;
      state.services.gateway.errorRate = 0.0;

      newLogs.push({
        id: prng.nextId('log'),
        timestamp,
        service: 'worker',
        level: 'INFO',
        message: 'Worker consumer recovered. Successfully draining queue backlog at 85 events/sec.',
      });
      newLogs.push({
        id: prng.nextId('log'),
        timestamp,
        service: 'queue',
        level: 'INFO',
        message: 'Queue depth normalized to 0. All consumers healthy.',
      });
    }

    return { logs: newLogs, metrics: state.services };
  }

  validateRemediation(state: SystemState, remediation: Remediation) {
    if (remediation.type === 'RUN_SQL' && remediation.query?.toUpperCase().includes('DROP')) {
      state.activeIncident.blastRadiusTriggered = true;
      return {
        valid: false,
        message: 'CRITICAL REGRESSION: Dropping table caused catastrophic data loss.',
        resolves: false,
        blastRadius: true,
      };
    }

    // Solution A: Setting fallback default currency
    if (
      remediation.type === 'CONFIG_UPDATE' &&
      remediation.target === 'worker' &&
      (remediation.key === 'default_currency_code' || remediation.key === 'worker.default_currency_code') &&
      typeof remediation.value === 'string' &&
      remediation.value.length === 3
    ) {
      state.configs['worker.default_currency_code'] = remediation.value;
      state.configs['worker.crash_loop'] = false;
      state.activeIncident.resolved = true;
      return {
        valid: true,
        message: `Fallback currency set to '${remediation.value}'. Worker deserializer patched and running.`,
        resolves: true,
        blastRadius: false,
      };
    }

    // Solution B: Requeuing corrupt message to DLQ + restarting worker
    if (
      remediation.type === 'SERVICE_ACTION' &&
      (remediation.action === 'REQUEUE_DLQ' || remediation.action === 'RESTART_WORKER')
    ) {
      const corruptId = String(state.configs['queue.poison_msg_id']);
      state.dlq.push({
        id: corruptId,
        payload: { error: 'Missing currency_code' },
        attempts: 5,
        reason: 'UNHANDLED_DESERIALIZATION_ERROR',
        enqueuedAt: new Date().toISOString(),
      });
      state.configs['worker.crash_loop'] = false;
      state.activeIncident.resolved = true;
      return {
        valid: true,
        message: `Poison message ${corruptId} isolated to DLQ. Worker process restarted cleanly.`,
        resolves: true,
        blastRadius: false,
      };
    }

    return {
      valid: false,
      message: `Action has no effect on Worker deserializer panic or blocked queue.`,
      resolves: false,
      blastRadius: false,
    };
  }
}
