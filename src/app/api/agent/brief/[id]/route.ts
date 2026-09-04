import { NextRequest, NextResponse } from 'next/server';
import { BlackBoxSimulator } from '@/lib/engine/simulator';
import { getStorage } from '@/lib/storage';

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const resolvedParams = await context.params;
    const sessionId = resolvedParams.id;

    const storage = getStorage();
    const session = await storage.getSession(sessionId);

    if (!session) {
      return NextResponse.json(
        { success: false, error: `Session not found: ${sessionId}` },
        { status: 404 }
      );
    }

    const brief = BlackBoxSimulator.getBrief(session);
    return NextResponse.json({ success: true, brief });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
