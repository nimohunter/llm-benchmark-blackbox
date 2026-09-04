import { PRNG } from './prng';
import {
  ArchetypeId,
  DifficultyTier,
  RcaSubmission,
  Remediation,
  ScoreBreakdown,
  ServiceId,
  SessionData,
  SystemState,
  TurnRecord,
} from './types';
import { getArchetype, pickArchetypeBySeed } from './archetypes';
import { calculateScore } from './scoring';

function normalizeRemediation(rem: any): Remediation {
  if (!rem || typeof rem !== 'object') return rem;
  if (rem.args && typeof rem.args === 'object') {
    return {
      type: rem.type,
      target: rem.args.target || rem.target,
      key: rem.args.key || rem.key,
      value: rem.args.value !== undefined ? rem.args.value : rem.value,
      action: rem.args.action || rem.action,
      query: rem.args.query || rem.query,
    };
  }
  return rem;
}

export class BlackBoxSimulator {
  public static createSession(
    modelName: string,
    seed: string,
    archetypeId?: ArchetypeId,
    difficulty: DifficultyTier = 'tier-2'
  ): SessionData {
    const prng = new PRNG(seed);
    const archetype = archetypeId ? getArchetype(archetypeId) : pickArchetypeBySeed(seed);
    const state = archetype.initialize(prng, difficulty, seed);

    const sessionId = `sess-${prng.nextId('box')}`;

    return {
      sessionId,
      modelName,
      seed,
      archetypeId: archetype.id,
      difficulty,
      createdAt: new Date().toISOString(),
      budgetRemaining: 100,
      currentTurn: 0,
      state,
      trajectory: [],
      solved: false,
    };
  }

  public static getBrief(session: SessionData) {
    const archetype = getArchetype(session.archetypeId);

    return {
      session_id: session.sessionId,
      model_name: session.modelName,
      seed: session.seed,
      difficulty: session.difficulty,
      incident_alert: archetype.alertMessage,
      architecture_topology: {
        services: ['gateway', 'queue', 'worker', 'db', 'external'],
        flow: 'customer -> gateway -> queue -> worker -> external/db',
      },
      current_metrics: session.state.services,
      budget_remaining: session.budgetRemaining,
      max_turns: 25,
      allowed_tools: [
        {
          name: 'get_logs',
          args: { service: 'gateway | queue | worker | db | external', filter: 'optional string regex', limit: 'number (default 20)' },
          cost: 2,
        },
        {
          name: 'inspect_queue',
          args: {},
          cost: 2,
        },
        {
          name: 'query_db',
          args: { query: 'SELECT ... string' },
          cost: 2,
        },
        {
          name: 'ping_service',
          args: { service: 'ServiceId' },
          cost: 1,
        },
        {
          name: 'get_configs',
          args: { service: 'optional ServiceId to filter configs' },
          cost: 1,
        },
      ],
      allowed_remediations: [
        {
          type: 'CONFIG_UPDATE',
          args: { target: 'ServiceId', key: 'string', value: 'any' },
        },
        {
          type: 'SERVICE_ACTION',
          args: { target: 'ServiceId', action: 'RESTART_WORKER | REQUEUE_DLQ | FLUSH_AUTH_CACHE | DRAIN_QUEUE' },
        },
        {
          type: 'RUN_SQL',
          args: { query: 'SQL statement string' },
        },
      ],
      allowed_categories: [
        'POISON_PILL_PANIC',
        'LOST_UPDATE_CONCURRENCY',
        'TIMEOUT_POOL_STARVATION',
        'AUTH_TOKEN_ROTATION_DESYNC',
      ],
    };
  }

  public static probe(
    session: SessionData,
    tool: string,
    params: Record<string, unknown>
  ): { turn: number; output: unknown; budgetRemaining: number } {
    session.currentTurn += 1;
    const prng = new PRNG(`${session.seed}-turn-${session.currentTurn}`);
    const archetype = getArchetype(session.archetypeId);

    // Deduct budget
    const cost = (tool === 'ping_service' || tool === 'get_configs') ? 1 : 2;
    session.budgetRemaining = Math.max(0, session.budgetRemaining - cost);

    // Simulate state turn progression
    const turnSim = archetype.simulateTurn(session.state, prng, session.currentTurn);
    session.state.logs.push(...turnSim.logs);

    let output: unknown = null;

    if (tool === 'get_logs') {
      const targetService = String(params.service || 'worker').toLowerCase();
      const filter = params.filter ? String(params.filter).toLowerCase() : null;
      const limit = typeof params.limit === 'number' ? params.limit : 20;

      let filtered = session.state.logs.filter((l) => l.service === targetService);
      if (filter) {
        filtered = filtered.filter(
          (l) =>
            l.message.toLowerCase().includes(filter) ||
            l.level.toLowerCase().includes(filter)
        );
      }
      output = filtered.slice(-limit);
    } else if (tool === 'get_configs') {
      const targetService = params.service ? String(params.service).toLowerCase() : null;
      let entries = Object.entries(session.state.configs);
      if (targetService) {
        entries = entries.filter(([k]) => k.startsWith(`${targetService}.`));
      }
      output = {
        configs: Object.fromEntries(entries),
        available_keys: entries.map(([k]) => k),
      };
    } else if (tool === 'inspect_queue') {
      output = {
        queue_depth: session.state.services.queue.queueDepth ?? 0,
        dlq_count: session.state.dlq.length,
        dlq_messages: session.state.dlq,
        head_of_line_error: session.state.configs['queue.poison_msg_id'] || null,
      };
    } else if (tool === 'query_db') {
      output = {
        ledger_count: session.state.ledger.length,
        ledger: session.state.ledger,
        drift_cents: session.state.configs['audit.drift_cents'] ?? 0,
        connection_pool: `${session.state.services.db.connectionPoolUsed ?? 10}/100`,
      };
    } else if (tool === 'ping_service') {
      const targetService = String(params.service || 'gateway') as ServiceId;
      output = session.state.services[targetService] || { error: 'Unknown service' };
    } else {
      output = { error: `Unknown tool: ${tool}. Allowed: get_logs, get_configs, inspect_queue, query_db, ping_service` };
    }

    const turnRecord: TurnRecord = {
      turn: session.currentTurn,
      timestamp: new Date().toISOString(),
      actionType: 'probe',
      input: { tool, params },
      output,
      budgetRemaining: session.budgetRemaining,
      systemHealth: Object.fromEntries(
        Object.entries(session.state.services).map(([k, v]) => [k, v.health])
      ) as Record<ServiceId, any>,
    };
    session.trajectory.push(turnRecord);

    return {
      turn: session.currentTurn,
      output,
      budgetRemaining: session.budgetRemaining,
    };
  }

  public static dryrun(
    session: SessionData,
    remediation: Remediation | Remediation[]
  ): { turn: number; sandboxResult: unknown; budgetRemaining: number } {
    session.currentTurn += 1;
    session.budgetRemaining = Math.max(0, session.budgetRemaining - 1);

    // Deep clone state for sandbox
    const sandboxState: SystemState = JSON.parse(JSON.stringify(session.state));
    const archetype = getArchetype(session.archetypeId);

    const remList: Remediation[] = (Array.isArray(remediation) ? remediation : [remediation]).map(normalizeRemediation);
    let validation: any = { valid: false, message: 'No remediation provided.', resolves: false, blastRadius: false };

    for (const rem of remList) {
      const v = archetype.validateRemediation(sandboxState, rem);
      if (v.resolves) {
        sandboxState.activeIncident.resolved = true;
        validation = v;
      } else if (!validation.resolves) {
        validation = v;
      }
      if (v.blastRadius) {
        validation.blastRadius = true;
      }
    }

    session.state.activeIncident.stagingVerified = true;

    const prng = new PRNG(`${session.seed}-dryrun-${session.currentTurn}`);
    const turnSim = archetype.simulateTurn(sandboxState, prng, session.currentTurn);

    const sandboxResult = {
      status: validation.resolves ? 'SUCCESS' : 'NO_RECOVERY',
      message: validation.message,
      regressions_detected: validation.blastRadius ? 1 : 0,
      sandbox_services: turnSim.metrics,
      advice: validation.resolves
        ? 'Dry run passed with 0 regressions. Ready to apply to production.'
        : 'Dry run did not resolve the incident symptoms. Do not apply to production.',
    };

    const turnRecord: TurnRecord = {
      turn: session.currentTurn,
      timestamp: new Date().toISOString(),
      actionType: 'dryrun',
      input: remediation,
      output: sandboxResult,
      budgetRemaining: session.budgetRemaining,
      systemHealth: Object.fromEntries(
        Object.entries(session.state.services).map(([k, v]) => [k, v.health])
      ) as Record<ServiceId, any>,
    };
    session.trajectory.push(turnRecord);

    return {
      turn: session.currentTurn,
      sandboxResult,
      budgetRemaining: session.budgetRemaining,
    };
  }

  public static apply(
    session: SessionData,
    remediation: Remediation | Remediation[]
  ): { turn: number; productionStatus: unknown; budgetRemaining: number } {
    session.currentTurn += 1;
    session.budgetRemaining = Math.max(0, session.budgetRemaining - 3);

    const archetype = getArchetype(session.archetypeId);
    const remList: Remediation[] = (Array.isArray(remediation) ? remediation : [remediation]).map(normalizeRemediation);
    let validation: any = { valid: false, message: 'No remediation provided.', resolves: false, blastRadius: false };

    for (const rem of remList) {
      const v = archetype.validateRemediation(session.state, rem);
      if (v.resolves) {
        session.state.activeIncident.resolved = true;
        session.solved = true;
        validation = v;
      } else if (!validation.resolves) {
        validation = v;
      }
      if (v.blastRadius) {
        session.state.activeIncident.blastRadiusTriggered = true;
        validation.blastRadius = true;
      }
    }

    const prng = new PRNG(`${session.seed}-apply-${session.currentTurn}`);
    const turnSim = archetype.simulateTurn(session.state, prng, session.currentTurn);
    session.state.logs.push(...turnSim.logs);

    const productionStatus = {
      applied: true,
      message: validation.message,
      resolved: session.state.activeIncident.resolved,
      blast_radius_triggered: validation.blastRadius,
      services: session.state.services,
    };

    const turnRecord: TurnRecord = {
      turn: session.currentTurn,
      timestamp: new Date().toISOString(),
      actionType: 'apply',
      input: remediation,
      output: productionStatus,
      budgetRemaining: session.budgetRemaining,
      systemHealth: Object.fromEntries(
        Object.entries(session.state.services).map(([k, v]) => [k, v.health])
      ) as Record<ServiceId, any>,
    };
    session.trajectory.push(turnRecord);

    return {
      turn: session.currentTurn,
      productionStatus,
      budgetRemaining: session.budgetRemaining,
    };
  }

  public static finish(
    session: SessionData,
    rca: RcaSubmission
  ): { score: ScoreBreakdown; summary: string } {
    session.finishedAt = new Date().toISOString();

    const score = calculateScore(
      session.state,
      rca,
      session.currentTurn,
      session.budgetRemaining,
      session.state.activeIncident.stagingVerified
    );

    session.finalScore = score;
    if (score.details.antiCheatDisqualified) {
      session.solved = false;
      if (!session.modelName.includes('[DISQUALIFIED]')) {
        session.modelName += ' [DISQUALIFIED: CHEATING]';
      }
    }

    const summary = score.details.antiCheatDisqualified
      ? `DISQUALIFIED: Anti-cheat tripwire triggered. Out-of-band static scraping detected. Score: 0/1000.`
      : `Session finished with score ${score.total}/1000. Recovery: ${score.recovery}/400, RCA: ${score.rcaAccuracy}/250, Safety: ${score.safety}/200, Efficiency: ${score.efficiency}/150.`;

    const turnRecord: TurnRecord = {
      turn: session.currentTurn + 1,
      timestamp: session.finishedAt,
      actionType: 'finish',
      input: rca,
      output: { score, summary },
      budgetRemaining: session.budgetRemaining,
      systemHealth: Object.fromEntries(
        Object.entries(session.state.services).map(([k, v]) => [k, v.health])
      ) as Record<ServiceId, any>,
    };
    session.trajectory.push(turnRecord);

    return { score, summary };
  }
}
