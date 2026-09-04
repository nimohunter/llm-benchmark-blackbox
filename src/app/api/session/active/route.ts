import { NextRequest, NextResponse } from 'next/server';

export async function GET() {
  try {
    const globalStore = globalThis as unknown as {
      __blackbox_sessions?: Map<string, any>;
      __blackbox_batteries?: Map<string, any>;
    };

    const TEN_MINUTES_MS = 10 * 60 * 1000;
    const now = Date.now();

    const activeList: Array<{
      id: string;
      name: string;
      type: 'battery' | 'single';
      status: string;
      level?: string;
      createdAt: string;
      turnsUsed: number;
    }> = [];

    // 1. Collect active batteries
    if (globalStore.__blackbox_batteries) {
      for (const [batId, bat] of globalStore.__blackbox_batteries.entries()) {
        const ageMs = now - new Date(bat.createdAt).getTime();

        // Expire if not IN_PROGRESS or if idle with 0 turns for > 10m
        if (bat.status !== 'IN_PROGRESS') {
          continue;
        }
        if (ageMs > TEN_MINUTES_MS && bat.results.length === 0) {
          globalStore.__blackbox_batteries.delete(batId);
          continue;
        }

        activeList.push({
          id: batId,
          name: bat.modelName,
          type: 'battery',
          status: bat.status,
          level: `L${bat.currentLevel}/8`,
          createdAt: bat.createdAt,
          turnsUsed: bat.results.length,
        });
      }
    }

    // 2. Collect active single sessions
    if (globalStore.__blackbox_sessions) {
      for (const [sessId, sess] of globalStore.__blackbox_sessions.entries()) {
        const ageMs = now - new Date(sess.createdAt).getTime();

        // Expire if finished, or if idle with 0 turns for > 10m
        if (sess.finishedAt) {
          continue;
        }
        if (sessId.includes('battery') || sessId.startsWith('bat-')) {
          continue;
        }
        if (ageMs > TEN_MINUTES_MS && sess.currentTurn === 0) {
          globalStore.__blackbox_sessions.delete(sessId);
          continue;
        }

        activeList.push({
          id: sessId,
          name: sess.modelName,
          type: 'single',
          status: sess.solved ? 'RESOLVED' : 'ACTIVE',
          level: sess.difficulty,
          createdAt: sess.createdAt,
          turnsUsed: sess.currentTurn,
        });
      }
    }

    // Sort by newest first
    activeList.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

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

    const globalStore = globalThis as unknown as {
      __blackbox_sessions?: Map<string, any>;
      __blackbox_batteries?: Map<string, any>;
    };

    if (id.startsWith('bat-') && globalStore.__blackbox_batteries) {
      globalStore.__blackbox_batteries.delete(id);
    } else if (globalStore.__blackbox_sessions) {
      globalStore.__blackbox_sessions.delete(id);
    }

    return NextResponse.json({ success: true, dismissed: id });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
