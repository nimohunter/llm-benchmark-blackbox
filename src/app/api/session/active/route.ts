import { NextRequest, NextResponse } from 'next/server';
import { getStorage } from '@/lib/storage';

export async function GET() {
  try {
    const storage = getStorage();
    const [batteries, sessions] = await Promise.all([
      storage.getAllBatteries(),
      storage.getAllSessions(),
    ]);

    const sessionMap = new Map(sessions.map((s) => [s.sessionId, s]));
    const TWO_HOURS_MS = 2 * 60 * 60 * 1000;
    const now = Date.now();

    const activeList: Array<{
      id: string;
      name: string;
      type: 'battery' | 'single';
      status: string;
      level?: string;
      currentLevel?: number;
      totalLevels?: number;
      levelsCleared?: number;
      createdAt: string;
      finishedAt?: string;
      turnsUsed: number;
      currentSessionId?: string;
      compositeScore?: number;
    }> = [];

    // 1. Process batteries
    for (const bat of batteries) {
      const createdTime = new Date(bat.createdAt).getTime();
      const ageMs = now - createdTime;

      // Keep if IN_PROGRESS, or if finished within last 2 hours
      if (bat.status !== 'IN_PROGRESS' && ageMs > TWO_HOURS_MS) {
        continue;
      }

      // Calculate total turns including active session's in-flight turns
      const currentSession = bat.currentSessionId ? sessionMap.get(bat.currentSessionId) : null;
      const finishedTurns = bat.results ? bat.results.reduce((acc, r) => acc + (r.turnsUsed || 0), 0) : 0;
      const inFlightTurns = currentSession ? currentSession.currentTurn : 0;
      const totalTurns = finishedTurns + inFlightTurns;

      activeList.push({
        id: bat.batteryId,
        name: bat.modelName,
        type: 'battery',
        status: bat.status,
        level: `L${bat.currentLevel}/${bat.totalLevels || 8}`,
        currentLevel: bat.currentLevel,
        totalLevels: bat.totalLevels || 8,
        levelsCleared: bat.levelsCleared || 0,
        createdAt: bat.createdAt,
        finishedAt: bat.finishedAt,
        turnsUsed: totalTurns,
        currentSessionId: bat.currentSessionId,
        compositeScore: bat.compositeScore,
      });
    }

    // 2. Process standalone single sessions
    for (const sess of sessions) {
      if (sess.sessionId.includes('battery') || sess.sessionId.startsWith('bat-') || sess.seed?.startsWith('ladder-')) {
        continue;
      }

      const createdTime = new Date(sess.createdAt).getTime();
      const ageMs = now - createdTime;

      if (sess.finishedAt && ageMs > TWO_HOURS_MS) {
        continue;
      }

      activeList.push({
        id: sess.sessionId,
        name: sess.modelName,
        type: 'single',
        status: sess.finishedAt ? (sess.solved ? 'RESOLVED' : 'FAILED') : (sess.solved ? 'RESOLVED' : 'ACTIVE'),
        level: sess.difficulty,
        createdAt: sess.createdAt,
        finishedAt: sess.finishedAt,
        turnsUsed: sess.currentTurn,
        compositeScore: sess.finalScore?.total,
      });
    }

    // Sort: IN_PROGRESS first, then newest first
    activeList.sort((a, b) => {
      if (a.status === 'IN_PROGRESS' && b.status !== 'IN_PROGRESS') return -1;
      if (b.status === 'IN_PROGRESS' && a.status !== 'IN_PROGRESS') return 1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    return NextResponse.json({
      success: true,
      active: activeList,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// Manual Dismissal
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ success: false, error: 'Missing id parameter' }, { status: 400 });
    }

    const storage = getStorage();
    if (id.startsWith('bat-')) {
      await storage.deleteBattery(id);
    } else {
      await storage.deleteSession(id);
    }

    return NextResponse.json({ success: true, dismissed: id });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
