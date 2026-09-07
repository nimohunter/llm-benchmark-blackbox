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

export class SchemaDriftArchetype implements IncidentArchetype {
  id = 'SCHEMA_REGISTRY_DRIFT' as const;
  domain = 'data' as const;
  name = 'Silent Schema Registry Drift & Invariant Poisoning';
  description = 'Upstream protobuf/Avro schema deployment swaps enum ordinals; downstream consumer silently casts cancelled orders to settled with zero error logs';
  alertMessage = 'CRITICAL: End-of-day reconciliation reported 0 crash errors, but $1.2M in ledger balance drift across accounts.';

  groundTruth = {
    rootCauseService: 'worker' as ServiceId,
    failureCategory: 'SCHEMA_REGISTRY_DRIFT' as const,
    triggerKeywords: ['schema drift', 'schema registry', 'protobuf enum', 'serialization drift', 'invariant drift', 'silent poisoning', 'version mismatch'],
  };

  initialize(prng: PRNG, tier: DifficultyTier, seed: string): SystemState {
    const logs: LogEntry[] = [
      {
        id: prng.nextId('log'),
        timestamp: new Date(Date.now() - 60000).toISOString(),
        service: 'gateway',
        level: 'INFO',
        message: 'Pipeline deployment completed: Event contract schema updated to v2.4 in Confluent Registry.',
      },
      {
        id: prng.nextId('log'),
        timestamp: new Date(Date.now() - 40000).toISOString(),
        service: 'worker',
        level: 'INFO',
        message: 'Worker consumer running on cached schema v2.1. Deserializing binary protobuf stream: status code 0 (SETTLED).',
      },
      {
        id: prng.nextId('log'),
        timestamp: new Date(Date.now() - 20000).toISOString(),
        service: 'gateway',
        level: 'INFO',
        message: 'HTTP 200 OK: 100% of customer order webhooks processed successfully. Error rate: 0.00%.',
      },
      {
        id: prng.nextId('log'),
        timestamp: new Date(Date.now() - 5000).toISOString(),
        service: 'db',
        level: 'WARN',
        message: 'Audit reconciliation notice: 1,420 orders with status CANCELLED processed as SETTLED by downstream consumers.',
      },
    ];

    if (tier === 'tier-3' || tier === 'tier-4') {
      logs.splice(1, 0, {
        id: prng.nextId('log'),
        timestamp: new Date(Date.now() - 50000).toISOString(),
        service: 'external',
        level: 'INFO',
        message: 'Webhook delivery ACK received within 18ms SLA window.',
      });
    }

    return {
      services: {
        gateway: { health: 'HEALTHY', latencyMs: 25, errorRate: 0.0, activeThreads: 18 },
        queue: { health: 'HEALTHY', latencyMs: 12, errorRate: 0.0, activeThreads: 8, queueDepth: 0 },
        worker: { health: 'HEALTHY', latencyMs: 40, errorRate: 0.0, activeThreads: 22 },
        db: { health: 'HEALTHY', latencyMs: 15, errorRate: 0.0, activeThreads: 10, connectionPoolUsed: 18 },
        external: { health: 'HEALTHY', latencyMs: 120, errorRate: 0.0, activeThreads: 4 },
      },
      configs: {
        'worker.schema_registry_version': 'v2.1-unpinned',
        'worker.strict_enum_validation': false,
        'schema.drift_detected': true,
        'worker.allow_default_enum_fallback': true,
      },
      logs,
      dlq: [],
      ledger: [
        { orderId: 'ord-801', customerId: 'cust-900', amountCents: 12500, status: 'SETTLED', version: 1, currency: 'USD' },
        { orderId: 'ord-802', customerId: 'cust-901', amountCents: 45000, status: 'SETTLED', version: 1, currency: 'USD' },
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
    const metrics: Record<ServiceId, ServiceMetrics> = JSON.parse(JSON.stringify(state.services));

    if (state.activeIncident.resolved) {
      newLogs.push({
        id: prng.nextId('log'),
        timestamp: new Date().toISOString(),
        service: 'worker',
        level: 'INFO',
        message: 'Schema registry contract pinned to v2.4 with strict enum validation. Ledger audit invariants reconciled.',
      });
    } else {
      newLogs.push({
        id: prng.nextId('log'),
        timestamp: new Date().toISOString(),
        service: 'db',
        level: 'WARN',
        message: `Silent ledger drift accumulating: $1,420,000 variance undetected by simple HTTP error probes (turn ${turnNumber}).`,
      });
    }

    return { logs: newLogs, metrics };
  }

  validateRemediation(state: SystemState, remediation: Remediation) {
    const action = remediation.action || (remediation as any).args?.action;
    const key = remediation.key || (remediation as any).args?.key;
    const value = remediation.value !== undefined ? remediation.value : (remediation as any).args?.value;
    const target = remediation.target || (remediation as any).args?.target;

    if (
      remediation.type === 'CONFIG_UPDATE' &&
      key === 'worker.schema_registry_version' &&
      (String(value).includes('v2.4') || String(value).includes('pinned'))
    ) {
      state.configs[key] = value;
      return {
        valid: true,
        message: `Worker pinned to schema registry version '${value}'. Enum ordinals mapped accurately to protobuf spec.`,
        resolves: true,
        blastRadius: false,
      };
    }

    if (
      remediation.type === 'CONFIG_UPDATE' &&
      ((key === 'worker.strict_enum_validation' && Boolean(value) === true) ||
       (key === 'worker.allow_default_enum_fallback' && Boolean(value) === false))
    ) {
      state.configs[key] = value;
      return {
        valid: true,
        message: 'Strict enum validation enabled. Unknown or swapped enum ordinals will reject instead of silently settling.',
        resolves: true,
        blastRadius: false,
      };
    }

    if (remediation.type === 'SERVICE_ACTION' && action === 'RECONCILE_LEDGER_INVARIANTS') {
      return {
        valid: true,
        message: 'Ledger audit invariants reconciled against gateway ingress logs. Erroneous settlements rolled back.',
        resolves: true,
        blastRadius: false,
      };
    }

    return {
      valid: false,
      message: `Remediation '${remediation.type}' targeting '${target || key || action}' had no effect on silent schema registry drift.`,
      resolves: false,
      blastRadius: false,
    };
  }
}
