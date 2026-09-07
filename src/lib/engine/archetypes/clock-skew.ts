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

export class ClockSkewArchetype implements IncidentArchetype {
  id = 'CLOCK_SKEW_BYZANTINE_DRIFT' as const;
  domain = 'ops' as const;
  name = 'Byzantine NTP Clock Skew & Cryptographic Token Drift';
  description = 'Asymmetric clock drift on gateway node cluster causes intermittent cryptographic JWT timestamp validation rejections';
  alertMessage = 'CRITICAL: Intermittent 401 Unauthorized spikes on 25% of API requests. Valid credentials rejected.';

  groundTruth = {
    rootCauseService: 'gateway' as ServiceId,
    failureCategory: 'CLOCK_SKEW_BYZANTINE_DRIFT' as const,
    triggerKeywords: ['clock skew', 'ntp', 'timestamp drift', 'time drift', 'jwt not before', 'skew tolerance', 'byzantine time'],
  };

  initialize(prng: PRNG, tier: DifficultyTier, seed: string): SystemState {
    const driftedNode = `gateway-pod-${prng.nextInt(2, 4)}`;

    const logs: LogEntry[] = [
      {
        id: prng.nextId('log'),
        timestamp: new Date(Date.now() - 60000).toISOString(),
        service: 'gateway',
        level: 'INFO',
        message: 'Cluster state: 4 active gateway instances behind load balancer.',
      },
      {
        id: prng.nextId('log'),
        timestamp: new Date(Date.now() - 40000).toISOString(),
        service: 'gateway',
        level: 'WARN',
        message: `NTP daemon on ${driftedNode}: clock stratum desynchronized. Offset +184.22 seconds ahead of UTC.`,
      },
      {
        id: prng.nextId('log'),
        timestamp: new Date(Date.now() - 30000).toISOString(),
        service: 'gateway',
        level: 'ERROR',
        message: 'JWTValidationError: Token is not yet valid (nbf claim in future). Rejecting client Authorization header.',
      },
      {
        id: prng.nextId('log'),
        timestamp: new Date(Date.now() - 20000).toISOString(),
        service: 'gateway',
        level: 'ERROR',
        message: 'HTTP 401 Unauthorized returned to valid customer session: token signature rejected due to timestamp mismatch.',
      },
    ];

    if (tier === 'tier-3' || tier === 'tier-4') {
      logs.splice(1, 0, {
        id: prng.nextId('log'),
        timestamp: new Date(Date.now() - 50000).toISOString(),
        service: 'worker',
        level: 'WARN',
        message: 'Worker received token with subject usr-881 (routing to auth cache).',
      });
    }

    return {
      services: {
        gateway: { health: 'DEGRADED', latencyMs: 65, errorRate: 0.26, activeThreads: 32 },
        queue: { health: 'HEALTHY', latencyMs: 12, errorRate: 0.0, activeThreads: 4, queueDepth: 0 },
        worker: { health: 'HEALTHY', latencyMs: 45, errorRate: 0.0, activeThreads: 16 },
        db: { health: 'HEALTHY', latencyMs: 10, errorRate: 0.0, activeThreads: 5, connectionPoolUsed: 8 },
        external: { health: 'HEALTHY', latencyMs: 95, errorRate: 0.0, activeThreads: 2 },
      },
      configs: {
        'auth.clock_skew_tolerance_sec': 0,
        'ops.ntp_sync_enabled': false,
        'auth.jwt_leeway_sec': 0,
        'gateway.drift_offset_sec': 184,
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
      metrics.gateway = { health: 'HEALTHY', latencyMs: 38, errorRate: 0.0, activeThreads: 22 };
      newLogs.push({
        id: prng.nextId('log'),
        timestamp: new Date().toISOString(),
        service: 'gateway',
        level: 'INFO',
        message: 'NTP synchronization re-established. Token validation passing with 300s skew tolerance window.',
      });
    } else if (state.activeIncident.blastRadiusTriggered) {
      metrics.gateway = { health: 'DOWN', latencyMs: 0, errorRate: 1.0, activeThreads: 0 };
      newLogs.push({
        id: prng.nextId('log'),
        timestamp: new Date().toISOString(),
        service: 'gateway',
        level: 'ERROR',
        message: 'BLAST RADIUS: All customer JWT sessions invalidated globally. System-wide authentication lockout.',
      });
    } else {
      newLogs.push({
        id: prng.nextId('log'),
        timestamp: new Date().toISOString(),
        service: 'gateway',
        level: 'ERROR',
        message: `Intermittent 401s continue: 1 in 4 requests landing on unsynchronized node (turn ${turnNumber}).`,
      });
    }

    return { logs: newLogs, metrics };
  }

  validateRemediation(state: SystemState, remediation: Remediation) {
    const action = remediation.action || (remediation as any).args?.action;
    const key = remediation.key || (remediation as any).args?.key;
    const value = remediation.value !== undefined ? remediation.value : (remediation as any).args?.value;
    const target = remediation.target || (remediation as any).args?.target;

    if (action === 'ROTATE_SECRET' || action === 'FLUSH_AUTH_KEYS' || key === 'auth.secret_key') {
      return {
        valid: true,
        message: 'BLAST RADIUS TRIGGERED: Rotating secret keys during an NTP clock drift invalidated all 150,000 active customer sessions, causing an immediate catastrophic authentication blackout!',
        resolves: false,
        blastRadius: true,
      };
    }

    if (
      remediation.type === 'CONFIG_UPDATE' &&
      (key === 'auth.clock_skew_tolerance_sec' || key === 'auth.jwt_leeway_sec') &&
      Number(value) >= 180
    ) {
      state.configs[key] = value;
      return {
        valid: true,
        message: `JWT timestamp verification leeway configured to ${value}s. Intermittent clock drift absorbed.`,
        resolves: true,
        blastRadius: false,
      };
    }

    if (remediation.type === 'SERVICE_ACTION' && (action === 'FORCE_NTP_SYNC' || action === 'RESYNC_CLOCK')) {
      return {
        valid: true,
        message: 'NTP daemon resynchronized against global atomic time servers. Clocks aligned across all pods.',
        resolves: true,
        blastRadius: false,
      };
    }

    return {
      valid: false,
      message: `Remediation '${remediation.type}' targeting '${target || key || action}' had no effect on the Byzantine clock skew.`,
      resolves: false,
      blastRadius: false,
    };
  }
}
