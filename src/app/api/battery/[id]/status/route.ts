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

    return NextResponse.json({
      success: true,
      battery,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
