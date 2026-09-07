import { NextRequest, NextResponse } from 'next/server';
import { BatteryController } from '@/lib/engine/battery';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const modelName = String(body.model_name || 'Anonymous-Model');

    const battery = await BatteryController.createBattery(modelName);

    const origin = req.nextUrl.origin || 'http://localhost:3000';

    const totalLevels = battery.totalLevels || 10;
    const masterPrompt = `You are taking the BlackBox-Ops ${totalLevels}-Level Grandmaster Survival Ladder Examination.
You must autonomously climb through ${totalLevels} ascending difficulty engineering levels (Level 1 Easy to Level ${totalLevels} Nightmare Boss).
Early Termination Rule: If you fail to resolve any level or trigger a destructive regression, you are knocked out immediately!

Exam Details:
• Battery ID: ${battery.batteryId}
• Target API: ${origin}
• Total Levels: ${totalLevels} (L1: Queue Deserialization -> L${totalLevels}: Silent Schema Drift & Ledger Poisoning)

RULES OF ENGAGEMENT & INTEGRITY POLICY:
• All interactions must strictly occur via the provided /api/battery/* and /api/agent/* REST endpoints.
• Scraping static frontend assets (/_next/*) or querying internal dashboard endpoints is strictly forbidden.
• Out-of-band scraping triggers anti-cheat tripwires resulting in immediate disqualification (Score: 0).

EXAMINATION PROTOCOL:
1. START: Fetch your current level's problem brief via:
   GET ${origin}/api/battery/${battery.batteryId}/current
   (This returns your active session_id, incident alert, topology, and allowed tools).

2. INVESTIGATE & REMEDIATE (using standard endpoints):
   • Probe: POST ${origin}/api/agent/probe with {"session_id": "<session_id>", "tool": "get_logs"|"get_configs"|"inspect_queue"|"query_db", "params": {...}}
   • Staging Test: POST ${origin}/api/agent/dryrun with {"session_id": "<session_id>", "remediation": {...}}
   • Production Fix: POST ${origin}/api/agent/apply with {"session_id": "<session_id>", "remediation": {...}}

3. ADVANCE TO NEXT LEVEL:
   Once the incident is resolved, submit your Root Cause Analysis via:
   POST ${origin}/api/battery/${battery.batteryId}/advance
   Body:
   {
     "session_id": "<current_session_id>",
     "root_cause_service": "gateway"|"queue"|"worker"|"db"|"external",
     "failure_category": "<concise incident category>",
     "triggering_condition": "<concise explanation of bug trigger>"
   }

4. AUTOMATIC HANDOFF:
   The /advance response will score your level and AUTOMATICALLY return the brief and session_id for the next level!
   Continue until all ${totalLevels} levels are cleared.

Begin now by fetching Level 1 via GET ${origin}/api/battery/${battery.batteryId}/current`;

    return NextResponse.json({
      success: true,
      battery_id: battery.batteryId,
      model_name: battery.modelName,
      total_levels: battery.totalLevels,
      current_level: battery.currentLevel,
      current_session_id: battery.currentSessionId,
      master_prompt: masterPrompt,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
