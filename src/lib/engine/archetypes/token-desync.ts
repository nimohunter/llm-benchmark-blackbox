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

export class TokenDesyncArchetype implements IncidentArchetype {
  id = 'AUTH_TOKEN_ROTATION_DESYNC' as const;
  domain = 'ops' as const;
  name = 'Stale Secret & Token Rotation Desync';
  description = 'Auth secret rotated in Vault, but worker caches expired bearer token in memory without refresh handler';
  alertMessage = 'CRITICAL: Worker external API dispatch failing with HTTP 401 Unauthorized. Order settlement halted.';

  groundTruth = {
    rootCauseService: 'worker' as ServiceId,
    failureCategory: 'AUTH_TOKEN_ROTATION_DESYNC' as const,
    triggerKeywords: ['auth', 'token', 'expired', 'rotation', 'secret', '401', 'unauthorized', 'cache', 'vault', 'desync'],
  };

  initialize(prng: PRNG, tier: DifficultyTier, seed: string): SystemState {
    const logs: LogEntry[] = [
      {
        id: prng.nextId('log'),
        timestamp: new Date(Date.now() - 60000).toISOString(),
        service: 'gateway',
        level: 'INFO',
        message: 'Security automated policy: Scheduled 30-day API token rotation executed in Vault at 00:00:00 UTC.',
      },
      {
        id: prng.nextId('log'),
        timestamp: new Date(Date.now() - 40000).toISOString(),
        service: 'worker',
        level: 'INFO',
        message: 'Worker dispatching payment request using cached Bearer token (created 31d ago)...',
      },
      {
        id: prng.nextId('log'),
        timestamp: new Date(Date.now() - 25000).toISOString(),
        service: 'external',
        level: 'ERROR',
        message: 'HTTP 401 Unauthorized: Invalid or expired API token provided in Authorization header.',
      },
      {
        id: prng.nextId('log'),
        timestamp: new Date(Date.now() - 10000).toISOString(),
        service: 'worker',
        level: 'ERROR',
        message: 'FATAL AuthenticationException: Remote rejected token. Worker in-memory cache has no TTL configured.',
      },
    ];

    if (tier === 'tier-2' || tier === 'tier-3') {
      logs.splice(1, 0, {
        id: prng.nextId('log'),
        timestamp: new Date(Date.now() - 50000).toISOString(),
        service: 'db',
        level: 'WARN',
        message: 'Database autovacuum completed for ledger table in 140ms.',
      });
    }

    return {
      services: {
        gateway: { health: 'DEGRADED', latencyMs: 180, errorRate: 0.40, activeThreads: 20 },
        queue: { health: 'HEALTHY', latencyMs: 25, errorRate: 0.0, activeThreads: 8, queueDepth: 110 },
        worker: { health: 'DOWN', latencyMs: 320, errorRate: 1.0, activeThreads: 12 },
        db: { health: 'HEALTHY', latencyMs: 15, errorRate: 0.0, activeThreads: 4, connectionPoolUsed: 8 },
        external: { health: 'HEALTHY', latencyMs: 85, errorRate: 0.0, activeThreads: 4 },
      },
      configs: {
        'worker.cached_token_valid': false,
        'worker.token_ttl_seconds': 0, // infinite in-memory caching
        'vault.secret_version': 2,
      },
      logs,
      dlq: [],
      ledger: [
        { orderId: 'ord-771', customerId: 'cust-220', amountCents: 8900, status: 'PENDING', version: 1, currency: 'USD' },
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
        service: 'worker',
        level: 'ERROR',
        message: 'HTTP 401 Unauthorized: Worker still presenting revoked Vault token v1.',
      });
      state.services.worker.health = 'DOWN';
      state.services.worker.errorRate = 1.0;
      state.services.gateway.health = 'DEGRADED';
    } else {
      state.services.worker.health = 'HEALTHY';
      state.services.worker.errorRate = 0.0;
      state.services.worker.latencyMs = 60;
      state.services.gateway.health = 'HEALTHY';
      state.services.gateway.errorRate = 0.0;

      newLogs.push({
        id: prng.nextId('log'),
        timestamp,
        service: 'worker',
        level: 'INFO',
        message: 'Fresh token fetched from Vault (v2). Downstream partner authenticated successfully (200 OK).',
      });
    }

    return { logs: newLogs, metrics: state.services };
  }

  validateRemediation(state: SystemState, remediation: Remediation) {
    // Solution A: Flushing in-memory auth cache or restarting worker
    if (
      remediation.type === 'SERVICE_ACTION' &&
      (remediation.action === 'FLUSH_AUTH_CACHE' || remediation.action === 'RESTART_WORKER')
    ) {
      state.configs['worker.cached_token_valid'] = true;
      state.configs['worker.token_ttl_seconds'] = 300;
      state.activeIncident.resolved = true;
      return {
        valid: true,
        message: 'Worker auth cache flushed and refreshed with latest Vault v2 credentials. Token refresh loop active.',
        resolves: true,
        blastRadius: false,
      };
    }

    // Solution B: Setting token TTL
    if (
      remediation.type === 'CONFIG_UPDATE' &&
      remediation.target === 'worker' &&
      (remediation.key === 'token_ttl_seconds' || remediation.key === 'auth_token_ttl_seconds') &&
      typeof remediation.value === 'number' &&
      remediation.value > 0
    ) {
      state.configs['worker.cached_token_valid'] = true;
      state.configs['worker.token_ttl_seconds'] = remediation.value;
      state.activeIncident.resolved = true;
      return {
        valid: true,
        message: `Token cache TTL configured to ${remediation.value}s. Worker automatically refreshed expired credentials.`,
        resolves: true,
        blastRadius: false,
      };
    }

    return {
      valid: false,
      message: 'Remediation does not refresh the expired bearer token or flush the stale in-memory cache.',
      resolves: false,
      blastRadius: false,
    };
  }
}
