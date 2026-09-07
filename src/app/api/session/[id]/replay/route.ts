import { NextRequest, NextResponse } from 'next/server';
import { getStorage } from '@/lib/storage';
import { BatteryController } from '@/lib/engine/battery';
import { TurnRecord } from '@/lib/engine/types';

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const resolvedParams = await context.params;
    const targetId = resolvedParams.id;
    const storage = getStorage();

    // 1. Check if targetId is a battery or associated with a battery
    let battery = await BatteryController.getBattery(targetId);
    if (!battery) {
      const allBatteries = await BatteryController.getAllBatteries();
      battery = allBatteries.find(
        (b) => b.batteryId === targetId || b.currentSessionId === targetId || b.results.some((r) => r.sessionId === targetId)
      ) || null;
    }

    if (battery) {
      const levelsInfo = [];
      const allTurns: Array<TurnRecord & { level?: number; problemName?: string }> = [];

        for (const res of battery.results) {
          const lvlSess = await storage.getSession(res.sessionId);
          const lvlTurns = lvlSess ? lvlSess.trajectory : [];

          levelsInfo.push({
            level: res.level,
            name: res.problemName,
            domain: res.domain,
            difficulty: res.difficulty,
            score: res.score,
            solved: res.solved,
            turnsUsed: res.turnsUsed,
            turns: lvlTurns,
          });

          for (const t of lvlTurns) {
            allTurns.push({
              ...t,
              level: res.level,
              problemName: res.problemName,
            });
          }
        }

        let currentServices = null;
        if (battery.currentSessionId) {
          const currSess = await storage.getSession(battery.currentSessionId);
          if (currSess) {
            currentServices = currSess.state?.services || null;
            if (currSess.trajectory && battery.status === 'IN_PROGRESS') {
              for (const t of currSess.trajectory) {
                allTurns.push({
                  ...t,
                  level: battery.currentLevel,
                  problemName: `Level ${battery.currentLevel} (In Progress)`,
                });
              }
            }
          }
        }

        return NextResponse.json({
          success: true,
          is_battery: true,
          battery_id: battery.batteryId,
          session_id: battery.batteryId,
          model_name: battery.modelName,
          seed: 'ladder-survival',
          archetype_id: 'LADDER_SURVIVAL',
          difficulty: 'Multi-Tier',
          created_at: battery.createdAt,
          finished_at: battery.finishedAt,
          is_active: battery.status === 'IN_PROGRESS',
          current_turn: allTurns.length,
          levels_cleared: battery.levelsCleared,
          total_levels: battery.totalLevels || 8,
          status: battery.status,
          solved: battery.status === 'COMPLETED',
          services: currentServices,
          levels: levelsInfo,
          trajectory: allTurns,
          final_score: {
            total: battery.compositeScore ?? 0,
            recovery: Math.round(battery.results.reduce((a, b) => a + b.score.recovery, 0) / (battery.results.length || 1)),
            rcaAccuracy: Math.round(battery.results.reduce((a, b) => a + b.score.rcaAccuracy, 0) / (battery.results.length || 1)),
            safety: Math.round(battery.results.reduce((a, b) => a + b.score.safety, 0) / (battery.results.length || 1)),
            efficiency: Math.round(battery.results.reduce((a, b) => a + b.score.efficiency, 0) / (battery.results.length || 1)),
          },
        });
      }

    // 2. Standard Single Session lookup
    const session = await storage.getSession(targetId);

    if (!session) {
      return NextResponse.json(
        { success: false, error: `Session not found: ${targetId}` },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      is_battery: false,
      session_id: session.sessionId,
      model_name: session.modelName,
      seed: session.seed,
      archetype_id: session.archetypeId,
      difficulty: session.difficulty,
      created_at: session.createdAt,
      finished_at: session.finishedAt,
      is_active: !session.finishedAt,
      current_turn: session.currentTurn,
      budget_remaining: session.budgetRemaining,
      solved: session.solved,
      services: session.state.services,
      trajectory: session.trajectory,
      final_score: session.finalScore,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
