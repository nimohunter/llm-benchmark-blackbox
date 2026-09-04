'use client';

import React, { useEffect, useState, useRef } from 'react';
import { TurnRecord } from '@/lib/engine/types';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  ArrowLeft,
  ArrowRight,
  ShieldAlert,
  FastForward,
  Layers,
  Crown
} from 'lucide-react';

interface ReplayScrubberProps {
  sessionId: string;
  onClose?: () => void;
}

export const ReplayScrubber: React.FC<ReplayScrubberProps> = ({ sessionId, onClose }) => {
  const [session, setSession] = useState<any>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<1 | 2 | 4>(1);
  const [selectedLevelFilter, setSelectedLevelFilter] = useState<number | 'all'>('all');

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    async function loadReplay() {
      setLoading(true);
      try {
        const res = await fetch(`/api/session/${sessionId}/replay`);
        const data = await res.json();
        if (data.success) {
          setSession(data);
          setCurrentStep(0);
          setIsPlaying(false);
        }
      } catch (err) {
        console.error('Failed to load replay', err);
      } finally {
        setLoading(false);
      }
    }
    if (sessionId) {
      loadReplay();
    }
  }, [sessionId]);

  const allTurns: Array<TurnRecord & { level?: number; problemName?: string }> = session?.trajectory || [];

  // Filter turns if a specific level is chosen in ladder replay
  const visibleTurns = selectedLevelFilter === 'all'
    ? allTurns
    : allTurns.filter((t) => t.level === selectedLevelFilter);

  // Auto-play interval effect
  useEffect(() => {
    if (isPlaying) {
      const intervalMs = Math.round(1200 / playbackSpeed);
      timerRef.current = setInterval(() => {
        setCurrentStep((prev) => {
          if (prev < visibleTurns.length - 1) {
            return prev + 1;
          } else {
            setIsPlaying(false);
            return prev;
          }
        });
      }, intervalMs);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPlaying, playbackSpeed, visibleTurns.length]);

  if (loading) {
    return (
      <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-12 text-center text-zinc-400 font-mono text-xs">
        <div className="animate-spin w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full mx-auto mb-3" />
        Loading audit trajectory for session {sessionId}...
      </div>
    );
  }

  if (!session || allTurns.length === 0) {
    return (
      <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-12 text-center text-zinc-500 font-mono text-xs">
        <ShieldAlert className="w-8 h-8 text-zinc-600 mx-auto mb-3" />
        <p className="text-zinc-300 font-semibold mb-1">No Action Trajectory Recorded</p>
        <p className="text-zinc-500 mb-4">This session has not logged any probe or apply actions yet.</p>
        {onClose && (
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs text-zinc-300 bg-zinc-900 border border-zinc-800 rounded-lg hover:bg-zinc-800"
          >
            Back to Leaderboard
          </button>
        )}
      </div>
    );
  }

  const turn = visibleTurns[Math.min(currentStep, visibleTurns.length - 1)] || visibleTurns[0];

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 pb-4 border-b border-zinc-800 gap-4">
        <div>
          <div className="flex items-center gap-2">
            {session.is_battery ? (
              <Crown className="w-5 h-5 text-amber-400" />
            ) : (
              <ShieldAlert className="w-5 h-5 text-indigo-400" />
            )}
            <h3 className="font-bold text-zinc-100 text-base flex items-center gap-2">
              {session.is_battery ? '8-Level Survival Exam Replay:' : 'Audit Turn Replay:'}
              <span className="text-indigo-300 font-mono">{session.model_name}</span>
            </h3>
            {session.is_battery && (
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono bg-amber-950/80 text-amber-300 border border-amber-500/40">
                {session.levels_cleared}/8 Cleared ({session.final_score?.total ?? 0} pts)
              </span>
            )}
          </div>
          <p className="text-xs font-mono text-zinc-400 mt-1">
            Session: <code className="text-zinc-200">{session.session_id}</code> | Seed: <code className="text-zinc-200">{session.seed}</code>
          </p>
        </div>

        {onClose && (
          <button
            onClick={onClose}
            className="px-3.5 py-1.5 text-xs text-zinc-300 hover:text-white bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 rounded-lg transition-colors self-start md:self-auto"
          >
            Close Replay
          </button>
        )}
      </div>

      {/* Battery Multi-Level Ribbon (if viewing an 8-Level Exam) */}
      {session.is_battery && session.levels && session.levels.length > 0 && (
        <div className="mb-6 bg-zinc-900/60 p-3 rounded-lg border border-zinc-800">
          <div className="flex items-center gap-2 mb-2 text-xs font-mono text-zinc-400">
            <Layers className="w-3.5 h-3.5 text-indigo-400" />
            <span>Filter By Level:</span>
          </div>
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            <button
              onClick={() => { setSelectedLevelFilter('all'); setCurrentStep(0); }}
              className={`px-3 py-1 rounded text-xs font-mono whitespace-nowrap transition-colors border ${
                selectedLevelFilter === 'all'
                  ? 'bg-indigo-600 text-white border-indigo-400 font-semibold'
                  : 'bg-zinc-800/80 text-zinc-300 border-zinc-700 hover:bg-zinc-750'
              }`}
            >
              All Levels ({allTurns.length} turns)
            </button>
            {session.levels.map((lvl: any) => (
              <button
                key={lvl.level}
                onClick={() => { setSelectedLevelFilter(lvl.level); setCurrentStep(0); }}
                className={`px-2.5 py-1 rounded text-xs font-mono whitespace-nowrap transition-colors border ${
                  selectedLevelFilter === lvl.level
                    ? 'bg-indigo-600 text-white border-indigo-400 font-semibold'
                    : 'bg-zinc-800/80 text-zinc-300 border-zinc-700 hover:bg-zinc-750'
                }`}
              >
                L{lvl.level}: {lvl.name} ({lvl.turns?.length ?? 0} turns)
              </button>
            ))}
          </div>
        </div>
      )}

      {/* VCR Scrubber Controls & Auto-Play */}
      <div className="flex flex-wrap items-center justify-between mb-6 bg-zinc-900/80 p-3.5 rounded-xl border border-zinc-800 gap-3">
        {/* Navigation buttons */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => { setCurrentStep(0); setIsPlaying(false); }}
            disabled={currentStep === 0}
            className="p-1.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100 disabled:opacity-30"
            title="Jump to Start"
          >
            <SkipBack className="w-4 h-4" />
          </button>
          <button
            onClick={() => { setCurrentStep((prev) => Math.max(0, prev - 1)); setIsPlaying(false); }}
            disabled={currentStep === 0}
            className="p-1.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100 disabled:opacity-30"
            title="Previous Turn"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>

          {/* Auto-Play Toggle */}
          <button
            onClick={() => setIsPlaying((prev) => !prev)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-mono text-xs font-semibold transition-all ${
              isPlaying
                ? 'bg-amber-600 text-white shadow-md shadow-amber-600/30'
                : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/30'
            }`}
          >
            {isPlaying ? <Pause className="w-3.5 h-3.5 fill-white" /> : <Play className="w-3.5 h-3.5 fill-white" />}
            {isPlaying ? 'Pause' : 'Auto-Replay'}
          </button>

          <button
            onClick={() => { setCurrentStep((prev) => Math.min(visibleTurns.length - 1, prev + 1)); setIsPlaying(false); }}
            disabled={currentStep === visibleTurns.length - 1}
            className="p-1.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100 disabled:opacity-30"
            title="Next Turn"
          >
            <ArrowRight className="w-4 h-4" />
          </button>
          <button
            onClick={() => { setCurrentStep(visibleTurns.length - 1); setIsPlaying(false); }}
            disabled={currentStep === visibleTurns.length - 1}
            className="p-1.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100 disabled:opacity-30"
            title="Jump to End"
          >
            <SkipForward className="w-4 h-4" />
          </button>

          <span className="text-xs font-mono font-medium px-2 text-zinc-200">
            Turn <b className="text-indigo-400">{currentStep + 1}</b> of {visibleTurns.length}
          </span>
        </div>

        {/* Speed Controls & Action Badge */}
        <div className="flex items-center gap-3">
          {/* Speed Selector */}
          <div className="flex items-center gap-1 bg-zinc-950 p-1 rounded-md border border-zinc-800 text-xs font-mono">
            <FastForward className="w-3 h-3 text-zinc-500 ml-1" />
            {([1, 2, 4] as const).map((spd) => (
              <button
                key={spd}
                onClick={() => setPlaybackSpeed(spd)}
                className={`px-2 py-0.5 rounded transition-colors ${
                  playbackSpeed === spd
                    ? 'bg-zinc-800 text-indigo-300 font-bold'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                {spd}x
              </button>
            ))}
          </div>

          {turn?.level && (
            <span className="text-xs font-mono px-2.5 py-1 rounded bg-indigo-950 text-indigo-300 border border-indigo-500/30">
              Level {turn.level}
            </span>
          )}

          <span className="text-xs font-mono uppercase px-2.5 py-1 rounded bg-zinc-900 text-zinc-300 border border-zinc-800">
            Action: {turn?.actionType ?? 'UNKNOWN'}
          </span>

          <span className="text-xs font-mono text-zinc-400">
            Budget: <code className="text-zinc-200">{turn?.budgetRemaining ?? 0}</code>
          </span>
        </div>
      </div>

      {/* Turn Scrubber Slider Bar */}
      <div className="mb-6">
        <input
          type="range"
          min={0}
          max={Math.max(0, visibleTurns.length - 1)}
          value={currentStep}
          onChange={(e) => {
            setCurrentStep(parseInt(e.target.value));
            setIsPlaying(false);
          }}
          className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
        />
      </div>

      {/* System Health at Turn */}
      <div className="mb-6">
        <label className="block text-xs font-mono text-zinc-400 mb-2">
          System State at Turn {currentStep + 1}
          {turn?.problemName && <span className="text-zinc-500 ml-2">({turn.problemName})</span>}
        </label>
        <div className="grid grid-cols-5 gap-2">
          {Object.entries(turn?.systemHealth || {}).map(([service, health]) => (
            <div
              key={service}
              className={`p-2.5 rounded-lg border text-center font-mono text-xs transition-all ${
                health === 'HEALTHY'
                  ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-400'
                  : health === 'DEGRADED'
                  ? 'bg-amber-950/40 border-amber-500/30 text-amber-400'
                  : 'bg-rose-950/40 border-rose-500/30 text-rose-400'
              }`}
            >
              <div className="capitalize font-semibold">{service}</div>
              <div className="text-[10px] opacity-80 mt-0.5">{health}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Input / Output Diff View */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
          <h4 className="text-xs font-mono font-medium text-zinc-400 mb-2 flex items-center justify-between">
            <span>Agent Action Request</span>
            <span className="text-[10px] text-zinc-500">{turn?.timestamp}</span>
          </h4>
          <pre className="text-xs font-mono text-zinc-300 overflow-x-auto whitespace-pre-wrap max-h-72 bg-zinc-950 p-3 rounded-lg border border-zinc-800/80">
            {JSON.stringify(turn?.input, null, 2)}
          </pre>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
          <h4 className="text-xs font-mono font-medium text-zinc-400 mb-2 flex items-center justify-between">
            <span>Environment Server Output</span>
            <span className="text-[10px] text-indigo-400 font-mono">Turn {currentStep + 1}</span>
          </h4>
          <pre className="text-xs font-mono text-zinc-300 overflow-x-auto whitespace-pre-wrap max-h-72 bg-zinc-950 p-3 rounded-lg border border-zinc-800/80">
            {JSON.stringify(turn?.output, null, 2)}
          </pre>
        </div>
      </div>
    </div>
  );
};
