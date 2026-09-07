import { NextRequest, NextResponse } from 'next/server';
import { BatteryController } from '@/lib/engine/battery';

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const resolvedParams = await context.params;
    const batteryId = resolvedParams.id;

    const battery = await BatteryController.getBattery(batteryId);
    if (!battery) {
      return NextResponse.json(
        { success: false, error: `Battery not found: ${batteryId}` },
        { status: 404 }
      );
    }

    let currentSession = null;
    if (battery.currentSessionId) {
      const { getStorage } = await import('@/lib/storage');
      const storage = getStorage();
      currentSession = await storage.getSession(battery.currentSessionId);
    }

    return NextResponse.json({
      success: true,
      battery,
      current_session: currentSession
        ? {
            sessionId: currentSession.sessionId,
            currentTurn: currentSession.currentTurn,
            budgetRemaining: currentSession.budgetRemaining,
            solved: currentSession.solved,
            services: currentSession.state?.services,
            logs: currentSession.state?.logs?.slice(-30),
            trajectory: currentSession.trajectory || [],
            activeIncident: currentSession.state?.activeIncident,
          }
        : null,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
