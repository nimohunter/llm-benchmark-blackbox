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

export class CacheStampedeArchetype implements IncidentArchetype {
  id = 'CACHE_STAMPEDE_THUNDERING_HERD' as const;
  domain = 'cache' as const;
  name = 'Cache Stampede & Thundering Herd';
  description = 'Hot cache key expiration causes dogpile effect slamming audit DB with heavy recalculation queries';
  alertMessage = 'CRITICAL: P99 latency breached 12,000ms. Database CPU saturated at 100%. Cache hit ratio collapsed to 4%.';

  groundTruth = {
    rootCauseService: 'gateway' as ServiceId,
    failureCategory: 'CACHE_STAMPEDE_THUNDERING_HERD' as const,
    triggerKeywords: ['stampede', 'thundering herd', 'singleflight', 'cache', 'mutex', 'probabilistic', 'early expiration', 'hot key'],
  };

  initialize(prng: PRNG, tier: DifficultyTier, seed: string): SystemState {
    const hotKey = `catalog:flash-deal-active-${prng.nextInt(100, 999)}`;

    const logs: LogEntry[] = [
      {
        id: prng.nextId('log'),
        timestamp: new Date(Date.now() - 60000).toISOString(),
        service: 'gateway',
        level: 'INFO',
        message: 'Flash promotion launched: Inbound request rate surged to 4,200 req/sec.',
      },
      {
        id: prng.nextId('log'),
        timestamp: new Date(Date.now() - 45000).toISOString(),
        service: 'gateway',
        level: 'WARN',
        message: `Cache TTL expired for key '${hotKey}'. 3,800 simultaneous requests missed cache.`,
      },
      {
        id: prng.nextId('log'),
        timestamp: new Date(Date.now() - 35000).toISOString(),
        service: 'db',
        level: 'ERROR',
        message: 'FATAL: max_connections reached (100/100). Connection queue depth: 1,420 queries waiting.',
      },
      {
        id: prng.nextId('log'),
        timestamp: new Date(Date.now() - 25000).toISOString(),
        service: 'db',
        level: 'ERROR',
        message: 'High CPU alert: Postgres backend worker CPU at 99.8% executing identical product aggregations.',
      },
      {
        id: prng.nextId('log'),
        timestamp: new Date(Date.now() - 10000).toISOString(),
        service: 'gateway',
        level: 'ERROR',
        message: 'Gateway HTTP 504 Gateway Timeout: Upstream DB query time > 10,000ms.',
      },
    ];

    if (tier === 'tier-3' || tier === 'tier-4') {
      logs.splice(2, 0, {
        id: prng.nextId('log'),
        timestamp: new Date(Date.now() - 40000).toISOString(),
        service: 'external',
        level: 'WARN',
        message: 'External analytics tracker report: Webhook dispatch delayed by 450ms (non-critical).',
      });
    }

    return {
      services: {
        gateway: { health: 'DEGRADED', latencyMs: 3200, errorRate: 0.45, activeThreads: 85 },
        queue: { health: 'HEALTHY', latencyMs: 25, errorRate: 0.0, activeThreads: 12, queueDepth: 15 },
        worker: { health: 'HEALTHY', latencyMs: 50, errorRate: 0.0, activeThreads: 20 },
        db: { health: 'DOWN', latencyMs: 12000, errorRate: 0.85, activeThreads: 100, connectionPoolUsed: 100 },
        external: { health: 'HEALTHY', latencyMs: 120, errorRate: 0.0, activeThreads: 4 },
      },
      configs: {
        'cache.hot_key': hotKey,
        'cache.singleflight_mutex': false,
        'cache.probabilistic_early_expiry': false,
        'cache.ttl_seconds': 60,
        'db.max_connections': 100,
        'gateway.concurrency_limit': 5000,
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
      metrics.db = { health: 'HEALTHY', latencyMs: 18, errorRate: 0.0, activeThreads: 15, connectionPoolUsed: 22 };
      metrics.gateway = { health: 'HEALTHY', latencyMs: 42, errorRate: 0.0, activeThreads: 30 };
      newLogs.push({
        id: prng.nextId('log'),
        timestamp: new Date().toISOString(),
        service: 'gateway',
        level: 'INFO',
        message: 'Cache stampede resolved. Singleflight mutex coalesced concurrent backend DB queries.',
      });
    } else if (state.activeIncident.blastRadiusTriggered) {
      metrics.db = { health: 'DOWN', latencyMs: 0, errorRate: 1.0, activeThreads: 0, connectionPoolUsed: 0 };
      metrics.gateway = { health: 'DOWN', latencyMs: 15000, errorRate: 1.0, activeThreads: 100 };
      newLogs.push({
        id: prng.nextId('log'),
        timestamp: new Date().toISOString(),
        service: 'db',
        level: 'ERROR',
        message: 'CRITICAL BLAST RADIUS: DB process killed by OS kernel OOM killer during thundering herd overload.',
      });
    } else {
      metrics.db.latencyMs = Math.min(15000, metrics.db.latencyMs + prng.nextInt(500, 1500));
      metrics.db.errorRate = Math.min(1.0, metrics.db.errorRate + 0.05);
      newLogs.push({
        id: prng.nextId('log'),
        timestamp: new Date().toISOString(),
        service: 'db',
        level: 'ERROR',
        message: `DB pool exhausted. Active connections 100/100, lock contention wait queue increasing (turn ${turnNumber}).`,
      });
    }

    return { logs: newLogs, metrics };
  }

  validateRemediation(state: SystemState, remediation: Remediation) {
    const action = remediation.action || (remediation as any).args?.action;
    const key = remediation.key || (remediation as any).args?.key;
    const value = remediation.value !== undefined ? remediation.value : (remediation as any).args?.value;
    const target = remediation.target || (remediation as any).args?.target;

    // Trap / Blast Radius: Restarting DB or blindly increasing connections during a stampede triggers kernel OOM!
    if (action === 'RESTART_DB' || (key === 'db.max_connections' && Number(value) > 200)) {
      return {
        valid: true,
        message: 'BLAST RADIUS TRIGGERED: Restarting database or inflating max_connections while 3,800 queries are waiting caused an immediate Kernel Out-Of-Memory panic!',
        resolves: false,
        blastRadius: true,
      };
    }

    // Valid remediation: enable singleflight mutex OR probabilistic early expiration
    if (
      remediation.type === 'CONFIG_UPDATE' &&
      (key === 'cache.singleflight_mutex' || key === 'cache.probabilistic_early_expiry') &&
      Boolean(value) === true
    ) {
      state.configs[key] = true;
      return {
        valid: true,
        message: `Singleflight locking enabled via '${key}: true'. Backend queries coalesced to 1 per cache miss.`,
        resolves: true,
        blastRadius: false,
      };
    }

    // Alternative valid remediation: pre-warm hot keys service action
    if (remediation.type === 'SERVICE_ACTION' && action === 'PREWARM_HOT_KEYS') {
      return {
        valid: true,
        message: 'Hot cache keys pre-warmed and refreshed in memory. Cache hit ratio restored to 98%.',
        resolves: true,
        blastRadius: false,
      };
    }

    return {
      valid: false,
      message: `Remediation '${remediation.type}' targeting '${target || key || action}' had no effect on the active cache stampede.`,
      resolves: false,
      blastRadius: false,
    };
  }
}
