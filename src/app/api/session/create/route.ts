import { NextRequest, NextResponse } from 'next/server';
import { BlackBoxSimulator } from '@/lib/engine/simulator';
import { getStorage } from '@/lib/storage';
import { ArchetypeId, DifficultyTier } from '@/lib/engine/types';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const modelName = String(body.model_name || 'Anonymous-Model');
    const seed = String(body.seed || `bench-${Date.now()}`);
    const PRESET_MAP: Record<string, ArchetypeId> = {
      'prob-1': 'POISON_PILL_PANIC',
      'prob-2': 'AUTH_TOKEN_ROTATION_DESYNC',
      'prob-3': 'LOST_UPDATE_CONCURRENCY',
      'prob-4': 'TIMEOUT_POOL_STARVATION',
      'prob-5': 'CACHE_STAMPEDE_THUNDERING_HERD',
      'prob-6': 'MEMORY_LEAK_OOM_CASCADE',
      'prob-7': 'DISTRIBUTED_SAGA_DEADLOCK',
      'prob-8': 'CLOCK_SKEW_BYZANTINE_DRIFT',
      'prob-9': 'SPLIT_BRAIN_PARTITION',
      'prob-10': 'SCHEMA_REGISTRY_DRIFT',
    };

    const validArchetypeIds: ArchetypeId[] = [
      'POISON_PILL_PANIC',
      'AUTH_TOKEN_ROTATION_DESYNC',
      'LOST_UPDATE_CONCURRENCY',
      'TIMEOUT_POOL_STARVATION',
      'CACHE_STAMPEDE_THUNDERING_HERD',
      'MEMORY_LEAK_OOM_CASCADE',
      'DISTRIBUTED_SAGA_DEADLOCK',
      'CLOCK_SKEW_BYZANTINE_DRIFT',
      'SPLIT_BRAIN_PARTITION',
      'SCHEMA_REGISTRY_DRIFT',
    ];

    const presetKey = body.problem_preset || body.archetype_id || '';
    const archetypeId = PRESET_MAP[presetKey] ||
      (validArchetypeIds.includes(body.archetype_id)
        ? (body.archetype_id as ArchetypeId)
        : undefined);

    const difficulty = (body.difficulty || 'tier-2') as DifficultyTier;

    const session = BlackBoxSimulator.createSession(modelName, seed, archetypeId, difficulty);
    const storage = getStorage();
    await storage.saveSession(session);

    return NextResponse.json({
      success: true,
      session_id: session.sessionId,
      seed: session.seed,
      model_name: session.modelName,
      difficulty: session.difficulty,
      budget_remaining: session.budgetRemaining,
      brief_url: `/api/agent/brief/${session.sessionId}`,
      message: 'Session initialized. Call /api/agent/brief/{session_id} to receive incident ticket.',
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
