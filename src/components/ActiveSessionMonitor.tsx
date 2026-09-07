'use client';

import React, { useEffect, useState } from 'react';
import { Radio, CheckCircle2, Clock, Activity, ArrowRight, Zap, RefreshCw } from 'lucide-react';
import { TurnRecord } from '@/lib/engine/types';

interface ActiveSessionMonitorProps {
  sessionId: string;
  onSessionUpdated?: (sessionData: any) => void;
}

export const ActiveSessionMonitor: React.FC<ActiveSessionMonitorProps> = ({
  sessionId,
  onSessionUpdated,
}) => {
  const [data, setData] = useState<any>(null);
  const [polling, setPolling] = useState(true);

  const isBattery = sessionId.startsWith('bat-');

  const fetchStatus = async () => {
    try {
      if (isBattery) {
        const res = await fetch(`/api/battery/${sessionId}/status`);
        const resJson = await res.json();
        if (resJson.success && resJson.battery) {
          setData({ ...resJson.battery, current_session: resJson.current_session });
          if (resJson.current_session?.services && onSessionUpdated) {
            onSessionUpdated({ services: resJson.current_session.services });
          }
          if (resJson.battery.status !== 'IN_PROGRESS') {
            setPolling(false);
          }
        }
      } else {
        const res = await fetch(`/api/session/${sessionId}/replay`);
        const resJson = await res.json();
        if (resJson.success) {
          setData(resJson);
          if (onSessionUpdated) onSessionUpdated(resJson);
          if (resJson.finished_at) {
            setPolling(false);
          }
        }
      }
    } catch (err) {
      console.error('Failed to poll active status', err);
    }
  };

  useEffect(() => {
    fetchStatus();
    if (!polling) return;

    const interval = setInterval(fetchStatus, 1500);
    return () => clearInterval(interval);
  }, [sessionId, polling]);

  if (!data) return null;

  if (isBattery) {
    const battery = data;
    const isKnockedOut = battery.status === 'KNOCKED_OUT';
    const isCompleted = battery.status === 'COMPLETED';

    return (
      <div className="rounded-xl border border-indigo-500/30 bg-indigo-950/20 p-6 backdrop-blur">
        <div className="flex items-center justify-between mb-4 pb-4 border-b border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="relative">
              <Radio className="w-5 h-5 text-indigo-400" />
              {battery.status === 'IN_PROGRESS' && (
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-500 rounded-full animate-ping" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-zinc-100 text-sm">
                  Survival Ladder Exam: <span className="text-indigo-300 font-mono">{battery.modelName}</span>
                </h3>
                {battery.status === 'IN_PROGRESS' ? (
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono bg-emerald-950 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Level {battery.currentLevel} of 8 In-Progress
                  </span>
                ) : isCompleted ? (
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono bg-amber-950 text-amber-300 border border-amber-500/30 flex items-center gap-1 font-bold">
                    🏆 8/8 Cleared (Grandmaster)
                  </span>
                ) : (
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono bg-rose-950 text-rose-300 border border-rose-500/30 flex items-center gap-1 font-bold">
                    ☠️ Knocked Out at L{battery.results.length} ({battery.levelsCleared}/8 Cleared)
                  </span>
                )}
              </div>
              <p className="text-xs font-mono text-zinc-400 mt-0.5">
                Battery ID: <code className="text-zinc-200">{battery.batteryId}</code> | Active Session: <code className="text-zinc-200">{battery.currentSessionId}</code>
              </p>
            </div>
          </div>

          <button
            onClick={fetchStatus}
            className="flex items-center gap-1 text-xs font-mono text-zinc-400 hover:text-zinc-200 bg-zinc-900/80 px-2.5 py-1 rounded border border-zinc-800"
          >
            <RefreshCw className="w-3 h-3" />
            Poll
          </button>
        </div>

        {/* 8-Level Ladder Visual Progress */}
        <div className="mb-6">
          <div className="flex items-center justify-between text-xs font-mono text-zinc-400 mb-2">
            <span>Survival Ladder Progress</span>
            <span className="font-bold text-zinc-200">{battery.levelsCleared} / 8 Levels Cleared</span>
          </div>
          <div className="grid grid-cols-8 gap-2">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((lvl) => {
              const res = battery.results?.find((r: any) => r.level === lvl);
              const isCurrent = battery.currentLevel === lvl && battery.status === 'IN_PROGRESS';
              const passed = res && res.solved;
              const failed = res && !res.solved;

              return (
                <div
                  key={lvl}
                  className={`p-2 rounded-lg border text-center font-mono text-xs transition-all ${
                    passed
                      ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300'
                      : failed
                      ? 'bg-rose-950/60 border-rose-500/40 text-rose-300'
                      : isCurrent
                      ? 'bg-indigo-950/80 border-indigo-500 text-indigo-200 animate-pulse ring-1 ring-indigo-500'
                      : 'bg-zinc-900/50 border-zinc-800 text-zinc-600'
                  }`}
                >
                  <div className="font-bold">L{lvl}</div>
                  <div className="text-[10px] mt-0.5">
                    {passed ? `✓ ${res.score.total}` : failed ? '✗ FAIL' : isCurrent ? 'ACTIVE' : 'LOCKED'}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Live Active Level Stats & Action Stream */}
        {battery.status === 'IN_PROGRESS' && battery.current_session && (
          <div className="mb-6 pt-4 border-t border-zinc-800">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-mono font-medium text-indigo-300 flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                Active Level Telemetry: Turn {battery.current_session.currentTurn} / 25
              </span>
              <span className="text-xs font-mono text-zinc-400">
                Budget: <span className="font-bold text-amber-400">{battery.current_session.budgetRemaining}</span> / 100
              </span>
            </div>

            <div className="p-3 rounded-lg bg-zinc-900/80 border border-zinc-800">
              <h5 className="text-[11px] font-mono text-zinc-400 mb-2 flex items-center justify-between">
                <span>Real-Time Agent Actions (Level {battery.currentLevel})</span>
                <span className="text-zinc-500">{battery.current_session.trajectory?.length || 0} turns taken</span>
              </h5>

              {(!battery.current_session.trajectory || battery.current_session.trajectory.length === 0) ? (
                <div className="text-center py-3 text-xs font-mono text-zinc-500">
                  Model is inspecting brief... Awaiting first probe or remediation call.
                </div>
              ) : (
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {battery.current_session.trajectory.slice().reverse().map((turn: any) => (
                    <div
                      key={turn.turn}
                      className="p-2 rounded bg-zinc-950/70 border border-zinc-800 text-xs font-mono flex items-start justify-between"
                    >
                      <div className="min-w-0 pr-2">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="font-bold text-zinc-200">Turn {turn.turn}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-indigo-300 uppercase">
                            {turn.actionType}
                          </span>
                          <span className="text-[10px] text-zinc-500">
                            {new Date(turn.timestamp).toLocaleTimeString()}
                          </span>
                        </div>
                        <div className="text-[11px] text-zinc-400 truncate max-w-lg">
                          {JSON.stringify(turn.input)}
                        </div>
                      </div>
                      <div className="text-right text-[11px] text-zinc-500 shrink-0">
                        {turn.budgetRemaining} pts left
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Completed Level Breakdown */}
        {battery.results && battery.results.length > 0 && (
          <div className="border-t border-zinc-800 pt-4">
            <h4 className="text-xs font-mono font-medium text-zinc-400 mb-2">Level Transcript History</h4>
            <div className="space-y-1.5">
              {battery.results.map((r: any) => (
                <div
                  key={r.level}
                  className="flex items-center justify-between text-xs font-mono p-2 rounded bg-zinc-900/60 border border-zinc-800"
                >
                  <span className="text-zinc-300">
                    Level {r.level}: <span className="text-zinc-100 font-medium">{r.problemName}</span>
                  </span>
                  <div className="flex items-center gap-3">
                    <span className="text-zinc-500 text-[11px]">{r.turnsUsed} turns</span>
                    <span className={`font-bold ${r.solved ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {r.score.total} / 1000 pts
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  const trajectory: TurnRecord[] = data.trajectory || [];
  const latestTurn = trajectory[trajectory.length - 1];

  return (
    <div className="rounded-xl border border-indigo-500/30 bg-indigo-950/20 p-6 backdrop-blur">
      <div className="flex items-center justify-between mb-4 pb-4 border-b border-zinc-800">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Radio className="w-5 h-5 text-indigo-400" />
            {data.is_active && (
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-500 rounded-full animate-ping" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-zinc-100 text-sm">
                Live Model Evaluation Telemetry: <span className="text-indigo-300 font-mono">{data.model_name}</span>
              </h3>
              {data.is_active ? (
                <span className="px-2 py-0.5 rounded-full text-[11px] font-mono bg-emerald-950 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Testing In-Progress
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full text-[11px] font-mono bg-indigo-950 text-indigo-300 border border-indigo-500/30 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-indigo-400" />
                  Finished ({data.final_score?.total ?? 0}/1000 pts)
                </span>
              )}
            </div>
            <p className="text-xs font-mono text-zinc-400 mt-0.5">
              Session ID: <code className="text-zinc-200">{data.session_id}</code> | Seed: <code className="text-zinc-200">{data.seed}</code>
            </p>
          </div>
        </div>

        <button
          onClick={fetchStatus}
          className="flex items-center gap-1 text-xs font-mono text-zinc-400 hover:text-zinc-200 bg-zinc-900/80 px-2.5 py-1 rounded border border-zinc-800"
        >
          <RefreshCw className="w-3 h-3" />
          Poll
        </button>
      </div>

      {/* Progress & Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-zinc-900/60 rounded-lg p-3 border border-zinc-800">
          <div className="flex items-center justify-between text-xs text-zinc-400 mb-1">
            <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5 text-zinc-400" /> Current Turn</span>
            <span className="font-mono text-zinc-200 font-bold">{data.current_turn} / 25</span>
          </div>
          <div className="w-full bg-zinc-800 rounded-full h-1.5 overflow-hidden">
            <div
              className="bg-indigo-500 h-1.5 rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, (data.current_turn / 25) * 100)}%` }}
            />
          </div>
        </div>

        <div className="bg-zinc-900/60 rounded-lg p-3 border border-zinc-800">
          <div className="flex items-center justify-between text-xs text-zinc-400 mb-1">
            <span className="flex items-center gap-1"><Zap className="w-3.5 h-3.5 text-amber-400" /> Remaining Budget</span>
            <span className="font-mono text-zinc-200 font-bold">{data.budget_remaining} / 100</span>
          </div>
          <div className="w-full bg-zinc-800 rounded-full h-1.5 overflow-hidden">
            <div
              className="bg-amber-500 h-1.5 rounded-full transition-all duration-500"
              style={{ width: `${Math.max(0, data.budget_remaining)}%` }}
            />
          </div>
        </div>

        <div className="bg-zinc-900/60 rounded-lg p-3 border border-zinc-800">
          <div className="flex items-center justify-between text-xs text-zinc-400 mb-1">
            <span className="flex items-center gap-1"><Activity className="w-3.5 h-3.5 text-emerald-400" /> System Solved</span>
            <span className={`font-mono font-bold ${data.solved ? 'text-emerald-400' : 'text-amber-400'}`}>
              {data.solved ? 'Resolved ✓' : 'Degraded (Unsolved)'}
            </span>
          </div>
          <div className="text-[11px] text-zinc-500 font-mono mt-1">
            {data.solved ? 'System health restored to 100%' : 'Awaiting valid production patch'}
          </div>
        </div>
      </div>

      {/* Live Turn Action Feed */}
      <div>
        <h4 className="text-xs font-mono font-medium text-zinc-400 mb-2 flex items-center gap-1.5">
          <Activity className="w-3.5 h-3.5 text-indigo-400" />
          Real-Time Agent Action Log ({trajectory.length} actions logged)
        </h4>

        {trajectory.length === 0 ? (
          <div className="p-4 rounded-lg bg-zinc-900/40 border border-dashed border-zinc-800 text-center text-xs font-mono text-zinc-500">
            Waiting for model to make its first call (`/probe`, `/dryrun`, or `/apply`)...
          </div>
        ) : (
          <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
            {trajectory.slice().reverse().map((turn) => (
              <div
                key={turn.turn}
                className="p-2.5 rounded-lg bg-zinc-900/80 border border-zinc-800/80 flex items-start justify-between text-xs"
              >
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono font-bold text-zinc-300">Turn {turn.turn}</span>
                    <span className="font-mono uppercase text-[10px] px-2 py-0.5 rounded bg-zinc-800 text-indigo-300">
                      {turn.actionType}
                    </span>
                    <span className="text-[10px] font-mono text-zinc-500">
                      {new Date(turn.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <pre className="text-[11px] font-mono text-zinc-400 overflow-x-auto">
                    {JSON.stringify(turn.input)}
                  </pre>
                </div>
                <div className="text-right text-[11px] font-mono text-zinc-500">
                  Budget left: {turn.budgetRemaining}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
