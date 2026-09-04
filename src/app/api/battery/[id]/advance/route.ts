import { NextRequest, NextResponse } from 'next/server';
import { BatteryController } from '@/lib/engine/battery';
import { RcaSubmission } from '@/lib/engine/types';

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const resolvedParams = await context.params;
    const batteryId = resolvedParams.id;

    const body = await req.json().catch(() => ({}));
    const { root_cause_service, failure_category, triggering_condition, remediation_summary } = body;

    if (!root_cause_service || !failure_category) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing required fields: 'root_cause_service' and 'failure_category'.",
        },
        { status: 400 }
      );
    }

    const rca: RcaSubmission = {
      root_cause_service,
      failure_category,
      triggering_condition: triggering_condition || '',
      remediation_summary: remediation_summary || '',
    };

    const advanceResult = await BatteryController.advanceBattery(batteryId, rca);

    return NextResponse.json({
      success: true,
      battery_id: batteryId,
      ...advanceResult,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
