import { NextRequest, NextResponse } from 'next/server';
import { BatteryController } from '@/lib/engine/battery';

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const resolvedParams = await context.params;
    const batteryId = resolvedParams.id;

    const info = await BatteryController.getCurrentLevelInfo(batteryId);

    return NextResponse.json({
      success: true,
      battery_id: info.battery_id,
      model_name: info.model_name,
      status: info.status,
      current_level: info.current_level,
      total_levels: info.total_levels,
      level_name: info.level_config.name,
      domain: info.level_config.domain,
      difficulty: info.level_config.difficulty,
      session_id: info.current_session_id,
      brief: info.brief,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
