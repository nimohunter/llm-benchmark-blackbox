'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { TopologyMap } from '@/components/TopologyMap';
import { PromptKit } from '@/components/PromptKit';
import { LeaderboardTable } from '@/components/LeaderboardTable';
import { ReplayScrubber } from '@/components/ReplayScrubber';
import { ActiveSessionMonitor } from '@/components/ActiveSessionMonitor';
import { ShieldAlert, Trophy, Play, History, Users, X } from 'lucide-react';
import { ServiceMetrics } from '@/lib/engine/types';

export default function Home() {
  const [activeTab, setActiveTab] = useState<'control' | 'leaderboard' | 'replay'>('control');
  const [selectedReplayId, setSelectedReplayId] = useState<string | null>(null);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [activeFleet, setActiveFleet] = useState<Array<{ id: string; name: string; type: string; status: string; level?: string }>>([]);

  // Default simulated metrics for preview
  const [metrics, setMetrics] = useState<Record<string, ServiceMetrics>>({
    gateway: { health: 'DEGRADED', latencyMs: 650, errorRate: 0.15, activeThreads: 42 },
    queue: { health: 'DOWN', latencyMs: 1200, errorRate: 0.85, activeThreads: 10, queueDepth: 385 },
    worker: { health: 'DOWN', latencyMs: 0, errorRate: 1.0, activeThreads: 0 },
    external: { health: 'HEALTHY', latencyMs: 140, errorRate: 0.0, activeThreads: 4 },
    db: { health: 'HEALTHY', latencyMs: 12, errorRate: 0.0, activeThreads: 5, connectionPoolUsed: 12 },
  });

  const pollActiveFleet = async () => {
    try {
      const res = await fetch('/api/session/active');
      const data = await res.json();
      if (data.success && data.active) {
        setActiveFleet(data.active);
      }
    } catch {}
  };

  React.useEffect(() => {
    pollActiveFleet();
    const interval = setInterval(pollActiveFleet, 3000);
    return () => clearInterval(interval);
  }, []);

  const selectActiveModel = (sid: string) => {
    setActiveSessionId(sid);
    const url = sid.startsWith('bat-')
      ? `/api/battery/${sid}/current`
      : `/api/agent/brief/${sid}`;
    fetch(url)
      .then((res) => res.json())
      .then((data) => {
        if (data.brief?.current_metrics) {
          setMetrics(data.brief.current_metrics);
        }
      })
      .catch(console.error);
  };

  const handleDismissModel = async (e: React.MouseEvent, sid: string) => {
    e.stopPropagation();
    try {
      await fetch(`/api/session/active?id=${sid}`, { method: 'DELETE' });
      if (activeSessionId === sid) {
        setActiveSessionId(null);
      }
      pollActiveFleet();
    } catch {}
  };

  const handleSessionCreated = (sessionData: any) => {
    const sid = sessionData.session_id || sessionData.battery_id;
    if (sid) {
      selectActiveModel(sid);
      pollActiveFleet();
    }
  };

  const handleSessionUpdated = (sessionData: any) => {
    if (sessionData.services) {
      setMetrics(sessionData.services);
    }
  };

  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      const hash = window.location.hash.replace('#', '');
      if (hash === 'leaderboard' || hash === 'replay' || hash === 'control') {
        setActiveTab(hash as any);
      }
    }
  }, []);

  const switchTab = (tab: 'control' | 'leaderboard' | 'replay') => {
    setActiveTab(tab);
    if (typeof window !== 'undefined') {
      window.location.hash = tab;
    }
  };

  const handleSelectReplay = (sessionId: string) => {
    setSelectedReplayId(sessionId);
    switchTab('replay');
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans selection:bg-indigo-500 selection:text-white">
      {/* Header */}
      <header className="border-b border-zinc-800 bg-zinc-900/50 backdrop-blur sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-indigo-600/20 text-indigo-400 border border-indigo-500/30">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-base font-bold tracking-tight text-white flex items-center gap-2">
                BlackBox-Ops
                <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400 font-normal">
                  v1.0 MVP
                </span>
              </h1>
              <p className="text-xs text-zinc-400">
                Deterministic Multi-Turn Incident Resolution Benchmark for LLMs
              </p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center gap-1 bg-zinc-900 p-1 rounded-lg border border-zinc-800 text-xs">
            <button
              onClick={() => switchTab('control')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-colors ${
                activeTab === 'control'
                  ? 'bg-indigo-600 text-white font-medium'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Play className="w-3.5 h-3.5" />
              Mission Control
            </button>
            <button
              onClick={() => switchTab('leaderboard')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-colors ${
                activeTab === 'leaderboard'
                  ? 'bg-indigo-600 text-white font-medium'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Trophy className="w-3.5 h-3.5" />
              Leaderboard
            </button>
            <button
              onClick={() => switchTab('replay')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-colors ${
                activeTab === 'replay'
                  ? 'bg-indigo-600 text-white font-medium'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <History className="w-3.5 h-3.5" />
              Audit Replay
            </button>
            <Link
              href="/live"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-rose-300 hover:text-white hover:bg-rose-950/60 transition-colors font-medium border border-rose-500/40 ml-1 bg-rose-950/20"
            >
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
              Live Arena
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'control' && (
          <div className="space-y-8">
            {activeFleet.length > 0 && (
              <div className="flex items-center gap-3 p-3.5 bg-zinc-900/80 border border-zinc-800 rounded-xl overflow-x-auto text-xs shadow-inner">
                <span className="text-zinc-400 font-mono text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5 whitespace-nowrap">
                  <Users className="w-4 h-4 text-indigo-400" />
                  Active Model Fleet ({activeFleet.length}):
                </span>
                <div className="flex items-center gap-2">
                  {activeFleet.map((s) => (
                    <div
                      key={s.id}
                      onClick={() => selectActiveModel(s.id)}
                      className={`px-3 py-1.5 rounded-lg font-mono text-xs flex items-center gap-2 transition-all whitespace-nowrap border cursor-pointer ${
                        activeSessionId === s.id
                          ? 'bg-indigo-600 text-white border-indigo-400 font-semibold shadow-md shadow-indigo-600/30'
                          : 'bg-zinc-800/80 text-zinc-300 border-zinc-700 hover:bg-zinc-700'
                      }`}
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      <span>{s.name}</span>
                      <span className="text-[10px] opacity-75 font-normal">[{s.level || s.type}]</span>
                      <button
                        onClick={(e) => handleDismissModel(e, s.id)}
                        className="ml-1 text-zinc-400 hover:text-rose-300 hover:bg-zinc-700/60 p-0.5 rounded transition-colors"
                        title="Dismiss this agent run"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeSessionId && (
              <ActiveSessionMonitor
                sessionId={activeSessionId}
                onSessionUpdated={handleSessionUpdated}
              />
            )}
            <TopologyMap
              metrics={metrics}
              modelName={activeFleet.find((f) => f.id === activeSessionId)?.name}
              sessionId={activeSessionId || undefined}
            />
            <PromptKit onSessionCreated={handleSessionCreated} />
          </div>
        )}

        {activeTab === 'leaderboard' && (
          <div className="space-y-8">
            <LeaderboardTable onSelectReplay={handleSelectReplay} />
          </div>
        )}

        {activeTab === 'replay' && (
          <div className="space-y-8">
            {selectedReplayId ? (
              <ReplayScrubber
                sessionId={selectedReplayId}
                onClose={() => setSelectedReplayId(null)}
              />
            ) : (
              <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-12 text-center text-zinc-500 font-mono text-sm">
                No session selected. Choose a run from the{' '}
                <button
                  onClick={() => setActiveTab('leaderboard')}
                  className="text-indigo-400 hover:underline"
                >
                  Leaderboard
                </button>{' '}
                to watch its turn-by-turn replay.
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
