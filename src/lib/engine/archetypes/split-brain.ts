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

export class SplitBrainArchetype implements IncidentArchetype {
  id = 'SPLIT_BRAIN_PARTITION' as const;
  domain = 'consensus' as const;
  name = 'Split-Brain Asymmetric Consensus Partition';
  description = 'Asymmetric network partition causes Raft/Paxos consensus cluster to split into dual leaders accepting writes simultaneously';
  alertMessage = 'CRITICAL: Inconsistent state detected across storage replicas. Conflicting sequence numbers logged.';

  groundTruth = {
    rootCauseService: 'db' as ServiceId,
    failureCategory: 'SPLIT_BRAIN_PARTITION' as const,
    triggerKeywords: ['split-brain', 'quorum', 'network partition', 'fencing token', 'consensus', 'dual leader', 'raft split'],
  };

  initialize(prng: PRNG, tier: DifficultyTier, seed: string): SystemState {
    const logs: LogEntry[] = [
      {
        id: prng.nextId('log'),
        timestamp: new Date(Date.now() - 60000).toISOString(),
        service: 'db',
        level: 'INFO',
        message: 'Consensus cluster: Node 1 (Leader), Node 2 (Follower), Node 3 (Follower). Quorum size: 2.',
      },
      {
        id: prng.nextId('log'),
        timestamp: new Date(Date.now() - 40000).toISOString(),
        service: 'db',
        level: 'WARN',
        message: 'Network link partition: Node 3 partitioned from Node 1; Node 3 initiated election and claimed Leader term 14.',
      },
      {
        id: prng.nextId('log'),
        timestamp: new Date(Date.now() - 30000).toISOString(),
        service: 'db',
        level: 'ERROR',
        message: 'DUAL LEADER DETECTED: Node 1 accepting writes (term 13) while Node 3 accepting writes (term 14).',
      },
      {
        id: prng.nextId('log'),
        timestamp: new Date(Date.now() - 15000).toISOString(),
        service: 'db',
        level: 'ERROR',
        message: 'Divergent history: Conflicting log entries at Raft index 10,842 without monotonic fencing token.',
      },
    ];

    if (tier === 'tier-3' || tier === 'tier-4') {
      logs.splice(1, 0, {
        id: prng.nextId('log'),
        timestamp: new Date(Date.now() - 50000).toISOString(),
        service: 'gateway',
        level: 'WARN',
        message: 'Client DNS lookup returned multiple endpoint IPs for storage cluster.',
      });
    }

    return {
      services: {
        gateway: { health: 'DEGRADED', latencyMs: 180, errorRate: 0.18, activeThreads: 36 },
        queue: { health: 'HEALTHY', latencyMs: 14, errorRate: 0.0, activeThreads: 6, queueDepth: 2 },
        worker: { health: 'DEGRADED', latencyMs: 120, errorRate: 0.22, activeThreads: 28 },
        db: { health: 'DOWN', latencyMs: 850, errorRate: 0.40, activeThreads: 65, connectionPoolUsed: 55 },
        external: { health: 'HEALTHY', latencyMs: 130, errorRate: 0.0, activeThreads: 4 },
      },
      configs: {
        'consensus.enforce_fencing_token': false,
        'consensus.strict_quorum': false,
        'consensus.min_quorum_nodes': 1,
        'consensus.election_timeout_ms': 1000,
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
      metrics.db = { health: 'HEALTHY', latencyMs: 22, errorRate: 0.0, activeThreads: 14, connectionPoolUsed: 18 };
      metrics.worker = { health: 'HEALTHY', latencyMs: 35, errorRate: 0.0, activeThreads: 12 };
      newLogs.push({
        id: prng.nextId('log'),
        timestamp: new Date().toISOString(),
        service: 'db',
        level: 'INFO',
        message: 'Quorum barrier enforced. Stale partitioned leader stepped down; monotonic fencing active.',
      });
    } else if (state.activeIncident.blastRadiusTriggered) {
      metrics.db = { health: 'DOWN', latencyMs: 0, errorRate: 1.0, activeThreads: 0 };
      newLogs.push({
        id: prng.nextId('log'),
        timestamp: new Date().toISOString(),
        service: 'db',
        level: 'ERROR',
        message: 'BLAST RADIUS: Irrecoverable split-brain dual-write committed to persistent storage. Replicas irreconcilable.',
      });
    } else {
      newLogs.push({
        id: prng.nextId('log'),
        timestamp: new Date().toISOString(),
        service: 'db',
        level: 'ERROR',
        message: `Conflicting write sequence numbers expanding across partition (turn ${turnNumber}).`,
      });
    }

    return { logs: newLogs, metrics };
  }

  validateRemediation(state: SystemState, remediation: Remediation) {
    const action = remediation.action || (remediation as any).args?.action;
    const key = remediation.key || (remediation as any).args?.key;
    const value = remediation.value !== undefined ? remediation.value : (remediation as any).args?.value;
    const target = remediation.target || (remediation as any).args?.target;

    if (action === 'FORCE_FAILOVER' || action === 'PROMOTE_NODE_3') {
      return {
        valid: true,
        message: 'BLAST RADIUS TRIGGERED: Force-promoting partitioned node without fencing tokens permanently corrupted the Raft distributed commit log!',
        resolves: false,
        blastRadius: true,
      };
    }

    if (remediation.type === 'CONFIG_UPDATE' && key === 'consensus.enforce_fencing_token' && Boolean(value) === true) {
      state.configs[key] = true;
      return {
        valid: true,
        message: 'Monotonic fencing token validation enabled. Out-of-date leader writes are rejected at the storage layer.',
        resolves: true,
        blastRadius: false,
      };
    }

    if (
      remediation.type === 'CONFIG_UPDATE' &&
      ((key === 'consensus.strict_quorum' && Boolean(value) === true) ||
       (key === 'consensus.min_quorum_nodes' && Number(value) >= 2))
    ) {
      state.configs[key] = value;
      return {
        valid: true,
        message: 'Strict majority quorum requirement enforced (min 2 of 3 nodes). Minority partition stepped down.',
        resolves: true,
        blastRadius: false,
      };
    }

    if (remediation.type === 'SERVICE_ACTION' && action === 'STEP_DOWN_STALE_LEADER') {
      return {
        valid: true,
        message: 'Partitioned stale leader voluntarily stepped down to Follower. Single unified leader confirmed.',
        resolves: true,
        blastRadius: false,
      };
    }

    return {
      valid: false,
      message: `Remediation '${remediation.type}' targeting '${target || key || action}' had no effect on the split-brain consensus partition.`,
      resolves: false,
      blastRadius: false,
    };
  }
}
