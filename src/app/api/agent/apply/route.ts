import { NextRequest, NextResponse } from 'next/server';
import { BlackBoxSimulator } from '@/lib/engine/simulator';
import { getStorage } from '@/lib/storage';
import { Remediation } from '@/lib/engine/types';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { session_id, remediation } = body;

    if (!session_id || !remediation) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing required fields: 'session_id' and 'remediation'.",
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

    const result = BlackBoxSimulator.apply(session, remediation as Remediation);
    await storage.saveSession(session);

    return NextResponse.json({
      success: true,
      turn: result.turn,
      budget_remaining: result.budgetRemaining,
      production_status: result.productionStatus,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
