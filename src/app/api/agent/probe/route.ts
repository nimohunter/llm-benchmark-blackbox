import { NextRequest, NextResponse } from 'next/server';
import { BlackBoxSimulator } from '@/lib/engine/simulator';
import { getStorage } from '@/lib/storage';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { session_id, tool, params } = body;

    if (!session_id || !tool) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing required fields: 'session_id' and 'tool'. Allowed tools: get_logs, inspect_queue, query_db, ping_service",
        },
        { status: 400 }
      );
    }

    const storage = getStorage();
    const session = await storage.getSession(session_id);

    if (!session) {
      return NextResponse.json({ success: false, error: `Session not found: ${session_id}` }, { status: 404 });
    }

    if (session.budgetRemaining <= 0) {
      return NextResponse.json(
        { success: false, error: 'Turn budget exhausted. Please submit final /finish post-mortem.' },
        { status: 400 }
      );
    }

    const result = BlackBoxSimulator.probe(session, tool, params || {});
    await storage.saveSession(session);

    return NextResponse.json({
      success: true,
      turn: result.turn,
      budget_remaining: result.budgetRemaining,
      output: result.output,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
