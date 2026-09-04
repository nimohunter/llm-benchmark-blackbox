import { NextRequest, NextResponse } from 'next/server';
import { BlackBoxSimulator } from '@/lib/engine/simulator';
import { getStorage } from '@/lib/storage';
import { RcaSubmission } from '@/lib/engine/types';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { session_id, root_cause_service, failure_category, triggering_condition, remediation_summary } = body;

    if (!session_id || !root_cause_service || !failure_category) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing required fields: 'session_id', 'root_cause_service', and 'failure_category'.",
        },
        { status: 400 }
      );
    }

    const storage = getStorage();
    const session = await storage.getSession(session_id);

    if (!session) {
      return NextResponse.json({ success: false, error: `Session not found: ${session_id}` }, { status: 404 });
    }

    const rca: RcaSubmission = {
      root_cause_service,
      failure_category,
      triggering_condition: triggering_condition || '',
      remediation_summary: remediation_summary || '',
    };

    const finishResult = BlackBoxSimulator.finish(session, rca);
    await storage.saveSession(session);

    return NextResponse.json({
      success: true,
      session_id: session.sessionId,
      model_name: session.modelName,
      seed: session.seed,
      score: finishResult.score,
      summary: finishResult.summary,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
