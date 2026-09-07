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

export class MemoryLeakArchetype implements IncidentArchetype {
  id = 'MEMORY_LEAK_OOM_CASCADE' as const;
  domain = 'runtime' as const;
  name = 'Memory Leak & Stop-The-World GC Pause Cascade';
  description = 'Unbounded websocket event listener leak causes runaway V8 heap allocation and multi-second GC pauses';
  alertMessage = 'CRITICAL: Worker response time oscillating wildly (P99 > 8500ms). Node healthchecks failing intermittently.';

  groundTruth = {
    rootCauseService: 'worker' as ServiceId,
    failureCategory: 'MEMORY_LEAK_OOM_CASCADE' as const,
    triggerKeywords: ['memory leak', 'gc pause', 'garbage collection', 'heap', 'oom', 'event emitter', 'unbounded buffer', 'stop the world'],
  };

  initialize(prng: PRNG, tier: DifficultyTier, seed: string): SystemState {
    const leakedListeners = prng.nextInt(45000, 95000);

    const logs: LogEntry[] = [
      {
        id: prng.nextId('log'),
        timestamp: new Date(Date.now() - 60000).toISOString(),
        service: 'worker',
        level: 'INFO',
        message: 'Telemetry metrics: Active websocket client connections: 1,200.',
      },
      {
        id: prng.nextId('log'),
        timestamp: new Date(Date.now() - 45000).toISOString(),
        service: 'worker',
        level: 'WARN',
        message: `EventEmitter memory leak detected: ${leakedListeners} listeners added to EventEmitter. MaxListenersExceededWarning.`,
      },
      {
        id: prng.nextId('log'),
        timestamp: new Date(Date.now() - 35000).toISOString(),
        service: 'worker',
        level: 'WARN',
        message: 'V8 runtime metrics: Heap used: 1,840MB / 2,048MB (89.8%). GC scavenge duration: 320ms.',
      },
      {
        id: prng.nextId('log'),
        timestamp: new Date(Date.now() - 25000).toISOString(),
        service: 'worker',
        level: 'ERROR',
        message: 'Major GC pause: Mark-sweep compacted heap in 8,420ms. Process main thread blocked.',
      },
      {
        id: prng.nextId('log'),
        timestamp: new Date(Date.now() - 15000).toISOString(),
        service: 'gateway',
        level: 'ERROR',
        message: 'HTTP 504 Gateway Timeout: Upstream worker heartbeat deadline exceeded (worker unresponsive during GC).',
      },
    ];

    if (tier === 'tier-3' || tier === 'tier-4') {
      logs.splice(1, 0, {
        id: prng.nextId('log'),
        timestamp: new Date(Date.now() - 50000).toISOString(),
        service: 'external',
        level: 'WARN',
        message: 'Partner auth certificate renewed successfully (valid for 365 days).',
      });
    }

    return {
      services: {
        gateway: { health: 'DEGRADED', latencyMs: 2400, errorRate: 0.35, activeThreads: 62 },
        queue: { health: 'HEALTHY', latencyMs: 20, errorRate: 0.0, activeThreads: 8, queueDepth: 42 },
        worker: { health: 'DOWN', latencyMs: 8500, errorRate: 0.75, activeThreads: 48 },
        db: { health: 'HEALTHY', latencyMs: 14, errorRate: 0.0, activeThreads: 6, connectionPoolUsed: 15 },
        external: { health: 'HEALTHY', latencyMs: 110, errorRate: 0.0, activeThreads: 3 },
      },
      configs: {
        'worker.heap_limit_mb': 2048,
        'worker.max_event_listeners': 0, // 0 = unlimited leak
        'worker.leak_containment_mode': false,
        'worker.gc_interval_ms': 1000,
        'gateway.timeout_ms': 3000,
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
      metrics.worker = { health: 'HEALTHY', latencyMs: 35, errorRate: 0.0, activeThreads: 14 };
      metrics.gateway = { health: 'HEALTHY', latencyMs: 40, errorRate: 0.0, activeThreads: 24 };
      newLogs.push({
        id: prng.nextId('log'),
        timestamp: new Date().toISOString(),
        service: 'worker',
        level: 'INFO',
        message: 'Heap stabilized at 180MB / 2048MB. GC pause overhead dropped to < 5ms.',
      });
    } else {
      metrics.worker.latencyMs = Math.min(15000, metrics.worker.latencyMs + prng.nextInt(300, 800));
      metrics.worker.errorRate = Math.min(1.0, metrics.worker.errorRate + 0.05);
      newLogs.push({
        id: prng.nextId('log'),
        timestamp: new Date().toISOString(),
        service: 'worker',
        level: 'ERROR',
        message: `V8 Heap at 94% capacity. Major GC cycle scheduled (turn ${turnNumber}).`,
      });
    }

    return { logs: newLogs, metrics };
  }

  validateRemediation(state: SystemState, remediation: Remediation) {
    const action = remediation.action || (remediation as any).args?.action;
    const key = remediation.key || (remediation as any).args?.key;
    const value = remediation.value !== undefined ? remediation.value : (remediation as any).args?.value;
    const target = remediation.target || (remediation as any).args?.target;

    // Restart alone without fixing config will cause leak to re-accumulate
    if (action === 'RESTART_WORKER' && !state.configs['worker.leak_containment_mode'] && Number(state.configs['worker.max_event_listeners']) === 0) {
      return {
        valid: true,
        message: 'Worker restarted, but unbounded event listener leak remains active in code. Process will OOM again in 60s.',
        resolves: false,
        blastRadius: false,
      };
    }

    // Valid remediation 1: Enable leak containment or cap max event listeners
    if (
      remediation.type === 'CONFIG_UPDATE' &&
      ((key === 'worker.leak_containment_mode' && Boolean(value) === true) ||
       (key === 'worker.max_event_listeners' && Number(value) > 0 && Number(value) <= 100))
    ) {
      state.configs[key] = value;
      return {
        valid: true,
        message: `Memory leak bounded via '${key}: ${value}'. Stale listener handles will be automatically garbage collected.`,
        resolves: true,
        blastRadius: false,
      };
    }

    // Valid remediation 2: Config update followed by worker restart
    if (remediation.type === 'SERVICE_ACTION' && action === 'RESTART_WORKER' && (state.configs['worker.leak_containment_mode'] || Number(state.configs['worker.max_event_listeners']) > 0)) {
      return {
        valid: true,
        message: 'Worker restarted cleanly with bounded event listener limits. Heap memory flushed.',
        resolves: true,
        blastRadius: false,
      };
    }

    return {
      valid: false,
      message: `Remediation '${remediation.type}' targeting '${target || key || action}' had no effect on the V8 heap memory leak.`,
      resolves: false,
      blastRadius: false,
    };
  }
}
