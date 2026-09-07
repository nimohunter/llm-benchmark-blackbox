'use client';

import React, { useEffect, useState, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  Radio,
  Activity,
  RefreshCw,
  Zap,
  Clock,
  ShieldAlert,
  Trophy,
  CheckCircle2,
  XCircle,
  Play,
  Pause,
  Share2,
  Terminal,
  ExternalLink,
  ChevronRight,
  Database,
  Layers,
  Server,
  Globe,
  Flame,
  LayoutDashboard
} from 'lucide-react';
import { ServiceHealth, ServiceMetrics, TurnRecord } from '@/lib/engine/types';

function LivePageContent() {
  const searchParams = useSearchParams();
  const initialId = searchParams.get('id');

  const [activeFleet, setActiveFleet] = useState<any[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(initialId);
  const [statusData, setStatusData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [isAutoPolling, setIsAutoPolling] = useState(true);
  const [pollIntervalMs, setPollIntervalMs] = useState(2500);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date>(new Date());
  const [copiedLink, setCopiedLink] = useState(false);
  const terminalEndRef = useRef<HTMLDivElement>(null);

  // 1. Poll active fleet
  const fetchActiveFleet = async () => {
    try {
      const res = await fetch('/api/session/active');
      const data = await res.json();
      if (data.success && data.active) {
        setActiveFleet(data.active);
        // If no ID selected, pick the first active or recent
        if (!selectedId && data.active.length > 0) {
          setSelectedId(data.active[0].id);
        }
      }
    } catch (err) {
      console.error('Failed to poll active fleet', err);
    }
  };

  // 2. Poll detailed status for currently selected task
  const fetchSelectedDetails = async (id: string) => {
    if (!id) return;
    try {
      const isBat = id.startsWith('bat-');
      if (isBat) {
        const res = await fetch(`/api/battery/${id}/status`);
        const resJson = await res.json();
        if (resJson.success && resJson.battery) {
          setStatusData({
            isBattery: true,
            battery: resJson.battery,
            currentSession: resJson.current_session,
          });
        }
      } else {
        const res = await fetch(`/api/session/${id}/replay`);
        const resJson = await res.json();
        if (resJson.success) {
          setStatusData({
            isBattery: false,
            session: resJson,
          });
        }
      }
      setLastRefreshedAt(new Date());
    } catch (err) {
      console.error('Failed to fetch details for task', id, err);
    }
  };

  useEffect(() => {
    fetchActiveFleet();
  }, []);

  useEffect(() => {
    if (selectedId) {
      fetchSelectedDetails(selectedId);
    }
  }, [selectedId]);

  // Polling loop with document visibility optimization
  useEffect(() => {
    if (!isAutoPolling) return;

    const interval = setInterval(() => {
      if (document.visibilityState === 'hidden') return; // Pause when tab is hidden
      fetchActiveFleet();
      if (selectedId) {
        fetchSelectedDetails(selectedId);
      }
    }, pollIntervalMs);

    return () => clearInterval(interval);
  }, [selectedId, isAutoPolling, pollIntervalMs]);

  // Copy shareable spectator URL
  const handleShare = () => {
    if (typeof window === 'undefined' || !selectedId) return;
    const url = `${window.location.origin}/live?id=${selectedId}`;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  // Extract trajectory and active level data
  let trajectory: any[] = [];
  let modelName = 'Unknown Model';
  let currentLevelNum = 1;
  let totalLevelsNum = 10;
  let statusBadge = 'STANDBY';
  let turnsCount = 0;
  let budgetRemaining = 100;
  let currentMetrics: Record<string, ServiceMetrics> = {
    gateway: { health: 'HEALTHY', latencyMs: 45, errorRate: 0.0, activeThreads: 22 },
    queue: { health: 'HEALTHY', latencyMs: 15, errorRate: 0.0, activeThreads: 8, queueDepth: 0 },
    worker: { health: 'HEALTHY', latencyMs: 40, errorRate: 0.0, activeThreads: 16 },
    db: { health: 'HEALTHY', latencyMs: 12, errorRate: 0.0, activeThreads: 5, connectionPoolUsed: 12 },
    external: { health: 'HEALTHY', latencyMs: 120, errorRate: 0.0, activeThreads: 3 },
  };

  if (statusData) {
    if (statusData.isBattery) {
      const bat = statusData.battery;
      modelName = bat.modelName;
      currentLevelNum = bat.currentLevel;
      totalLevelsNum = bat.totalLevels || 10;
      statusBadge = bat.status;
      if (statusData.currentSession) {
        turnsCount = statusData.currentSession.currentTurn || 0;
        budgetRemaining = statusData.currentSession.budgetRemaining ?? 100;
        if (statusData.currentSession.services) {
          currentMetrics = { ...currentMetrics, ...statusData.currentSession.services };
        }
        trajectory = statusData.currentSession.trajectory || [];
      }
    } else if (statusData.session) {
      const sess = statusData.session;
      modelName = sess.model_name;
      currentLevelNum = 1;
      totalLevelsNum = 1;
      statusBadge = sess.is_active ? 'IN_PROGRESS' : sess.solved ? 'RESOLVED' : 'FAILED';
      turnsCount = sess.current_turn || 0;
      budgetRemaining = sess.budget_remaining ?? 100;
      if (sess.services) {
        currentMetrics = { ...currentMetrics, ...sess.services };
      }
      trajectory = sess.trajectory || [];
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans selection:bg-indigo-500 selection:text-white">
      {/* Top Navigation */}
      <header className="border-b border-zinc-800 bg-zinc-900/60 backdrop-blur sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-rose-500/20 text-rose-400 border border-rose-500/30 relative">
              <Radio className="w-5 h-5 animate-pulse text-rose-400" />
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-rose-500 rounded-full animate-ping" />
            </div>
            <div>
              <h1 className="text-base font-bold tracking-tight text-white flex items-center gap-2">
                BlackBox Live Arena
                <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-rose-950/80 text-rose-300 border border-rose-500/30 uppercase tracking-wider font-semibold">
                  Live Broadcast
                </span>
              </h1>
              <p className="text-xs text-zinc-400">Real-time distributed systems benchmark spectator broadcast</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/"
              className="px-3 py-1.5 rounded-lg border border-zinc-800 bg-zinc-900 text-xs text-zinc-300 hover:text-white hover:bg-zinc-800 flex items-center gap-1.5 transition-colors"
            >
              <LayoutDashboard className="w-3.5 h-3.5" />
              Dashboard Home
            </Link>

            <Link
              href="/#leaderboard"
              className="px-3 py-1.5 rounded-lg border border-zinc-800 bg-zinc-900 text-xs text-zinc-300 hover:text-white hover:bg-zinc-800 flex items-center gap-1.5 transition-colors"
            >
              <Trophy className="w-3.5 h-3.5 text-amber-400" />
              Leaderboard
            </Link>

            <div className="h-4 w-[1px] bg-zinc-800 mx-1" />

            <button
              onClick={() => setIsAutoPolling(!isAutoPolling)}
              className={`px-3 py-1.5 rounded-lg border text-xs font-mono flex items-center gap-1.5 transition-colors ${
                isAutoPolling
                  ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300'
                  : 'bg-zinc-900 border-zinc-800 text-zinc-400'
              }`}
            >
              {isAutoPolling ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Pause className="w-3 h-3" />}
              {isAutoPolling ? 'Live Polling' : 'Paused'}
            </button>

            {selectedId && (
              <button
                onClick={handleShare}
                className="px-3 py-1.5 rounded-lg border border-zinc-800 bg-zinc-900 text-xs text-zinc-300 hover:text-white hover:bg-zinc-800 flex items-center gap-1.5 transition-colors"
              >
                <Share2 className="w-3.5 h-3.5" />
                {copiedLink ? 'Copied!' : 'Share'}
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Active Fleets Strip */}
        <section className="bg-zinc-900/40 border border-zinc-800 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-mono uppercase tracking-wider text-zinc-400 flex items-center gap-2">
              <Activity className="w-4 h-4 text-indigo-400" />
              Active & Recent Evaluations ({activeFleet.length})
            </h2>
            <span className="text-[11px] font-mono text-zinc-500">
              Last synced: {lastRefreshedAt.toLocaleTimeString()}
            </span>
          </div>

          {activeFleet.length === 0 ? (
            <div className="py-6 text-center text-xs font-mono text-zinc-500 border border-dashed border-zinc-800 rounded-lg">
              No live test sessions running right now.{' '}
              <Link href="/" className="text-indigo-400 underline hover:text-indigo-300 ml-1">
                Generate a benchmark prompt
              </Link>{' '}
              to launch an evaluation.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {activeFleet.map((item) => {
                const isSelected = item.id === selectedId;
                const isRunning = item.status === 'IN_PROGRESS';
                const isCleared = item.status === 'COMPLETED' || item.status === 'RESOLVED';

                return (
                  <button
                    key={item.id}
                    onClick={() => setSelectedId(item.id)}
                    className={`text-left p-3 rounded-lg border transition-all relative overflow-hidden ${
                      isSelected
                        ? 'bg-indigo-950/60 border-indigo-500 shadow-lg shadow-indigo-500/10 ring-1 ring-indigo-500'
                        : 'bg-zinc-900/60 border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-mono font-bold text-zinc-200 truncate pr-2">
                        {item.name}
                      </span>
                      {isRunning ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-emerald-950 text-emerald-300 border border-emerald-500/40 flex items-center gap-1 shrink-0">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          LIVE
                        </span>
                      ) : isCleared ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-amber-950 text-amber-300 border border-amber-500/40 shrink-0">
                          🏆 CLEARED
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-rose-950 text-rose-300 border border-rose-500/40 shrink-0">
                          ☠️ KNOCKED OUT
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between text-[11px] font-mono text-zinc-400">
                      <span>{item.level || 'Survival Ladder'}</span>
                      <span>{item.turnsUsed} turns</span>
                    </div>
                    <div className="text-[10px] font-mono text-zinc-500 mt-1 truncate">
                      ID: {item.id}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {/* Selected Model Spectator Stage */}
        {selectedId && (
          <section className="space-y-6">
            {/* Live Model Headline Banner */}
            <div className="rounded-xl border border-indigo-500/30 bg-gradient-to-r from-indigo-950/40 via-zinc-900/60 to-zinc-950 p-6 backdrop-blur shadow-2xl">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-800 pb-5">
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                      {modelName}
                      {statusBadge === 'IN_PROGRESS' ? (
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-mono bg-emerald-950 text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5 font-normal">
                          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                          Climbing Ladder • Level {currentLevelNum} of {totalLevelsNum}
                        </span>
                      ) : statusBadge === 'COMPLETED' ? (
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-mono bg-amber-950 text-amber-300 border border-amber-500/30 flex items-center gap-1 font-bold">
                          🏆 Grandmaster Certified ({statusData?.battery?.compositeScore ?? 1000}/1000)
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-mono bg-rose-950 text-rose-300 border border-rose-500/30 flex items-center gap-1 font-bold">
                          ☠️ Knocked Out at L{currentLevelNum}
                        </span>
                      )}
                    </h2>
                  </div>
                  <p className="text-xs font-mono text-zinc-400">
                    Watching Task: <code className="text-zinc-200">{selectedId}</code>
                    {statusData?.battery?.currentSessionId && (
                      <span> • Active Session: <code className="text-zinc-200">{statusData.battery.currentSessionId}</code></span>
                    )}
                  </p>
                </div>

                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className="text-xs text-zinc-400 font-mono">Current Level Turn</div>
                    <div className="text-lg font-bold font-mono text-zinc-100">{turnsCount} / 25</div>
                  </div>
                  <div className="h-8 w-[1px] bg-zinc-800" />
                  <div className="text-right">
                    <div className="text-xs text-zinc-400 font-mono">Budget Left</div>
                    <div className={`text-lg font-bold font-mono ${budgetRemaining < 20 ? 'text-rose-400' : 'text-amber-400'}`}>
                      {budgetRemaining} / 100
                    </div>
                  </div>
                  <div className="h-8 w-[1px] bg-zinc-800" />
                  <Link
                    href={`/#replay`}
                    className="p-2.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white transition-colors text-xs font-mono flex items-center gap-1"
                    title="Open Full Replay Scrubber"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Replay
                  </Link>
                </div>
              </div>

              {/* Ladder Stepper Bar */}
              {statusData?.isBattery && (
                <div className="mt-5">
                  <div className="flex items-center justify-between text-xs font-mono text-zinc-400 mb-2">
                    <span>10-Level Grandmaster Survival Ladder</span>
                    <span className="font-bold text-zinc-200">
                      {statusData.battery.levelsCleared} of {totalLevelsNum} Cleared
                    </span>
                  </div>
                  <div className="grid grid-cols-5 sm:grid-cols-10 gap-1.5">
                    {Array.from({ length: totalLevelsNum }).map((_, idx) => {
                      const lvl = idx + 1;
                      const res = statusData.battery.results?.find((r: any) => r.level === lvl);
                      const isCurrent = statusData.battery.currentLevel === lvl && statusData.battery.status === 'IN_PROGRESS';
                      const passed = res && res.solved;
                      const failed = res && !res.solved;

                      return (
                        <div
                          key={lvl}
                          className={`p-2 rounded border text-center font-mono text-xs transition-all ${
                            passed
                              ? 'bg-emerald-950/70 border-emerald-500/50 text-emerald-300'
                              : failed
                              ? 'bg-rose-950/70 border-rose-500/50 text-rose-300'
                              : isCurrent
                              ? 'bg-indigo-950 border-indigo-400 text-indigo-200 ring-2 ring-indigo-500/50 animate-pulse'
                              : 'bg-zinc-900/40 border-zinc-800/80 text-zinc-600'
                          }`}
                        >
                          <div className="font-bold">L{lvl}</div>
                          <div className="text-[10px] mt-0.5 truncate">
                            {passed ? `✓ ${res.score.total}` : failed ? '☠ FAIL' : isCurrent ? 'ACTIVE' : 'LOCKED'}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Live Topology Grid */}
            <div className="rounded-xl border border-zinc-800 bg-zinc-950/80 p-6 backdrop-blur shadow-xl">
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-zinc-800">
                <h3 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
                  <Globe className="w-4 h-4 text-indigo-400" />
                  Live System Architecture & Health Telemetry
                </h3>
                <span className="text-[11px] font-mono text-zinc-500">Auto-updating per probe / fix</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                {[
                  { id: 'gateway', name: 'API Gateway', icon: <Globe className="w-4 h-4" />, metric: currentMetrics.gateway, desc: 'Ingestion & Rate Limit' },
                  { id: 'queue', name: 'Event Queue', icon: <Layers className="w-4 h-4" />, metric: currentMetrics.queue, desc: `Depth: ${currentMetrics.queue?.queueDepth ?? 0} msgs` },
                  { id: 'worker', name: 'Worker Service', icon: <Server className="w-4 h-4" />, metric: currentMetrics.worker, desc: 'Consumer & Business Logic' },
                  { id: 'external', name: 'External Partner', icon: <Activity className="w-4 h-4" />, metric: currentMetrics.external, desc: '3rd-Party Gateway' },
                  { id: 'db', name: 'Database', icon: <Database className="w-4 h-4" />, metric: currentMetrics.db, desc: `Pool: ${currentMetrics.db?.connectionPoolUsed ?? 0}/100` },
                ].map((node) => {
                  const health = node.metric?.health || 'HEALTHY';
                  const isHealthy = health === 'HEALTHY';
                  const isDegraded = health === 'DEGRADED';
                  const isDown = health === 'DOWN';

                  return (
                    <div
                      key={node.id}
                      className={`p-3.5 rounded-lg border flex flex-col justify-between transition-all ${
                        isHealthy
                          ? 'bg-zinc-900/50 border-zinc-800'
                          : isDegraded
                          ? 'bg-amber-950/30 border-amber-500/40 ring-1 ring-amber-500/20'
                          : 'bg-rose-950/30 border-rose-500/40 ring-1 ring-rose-500/20'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2 text-zinc-200 text-xs font-semibold">
                          {node.icon}
                          {node.name}
                        </div>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase font-bold ${
                            isHealthy
                              ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/30'
                              : isDegraded
                              ? 'bg-amber-950 text-amber-300 border border-amber-500/30 animate-pulse'
                              : 'bg-rose-950 text-rose-300 border border-rose-500/30 animate-ping'
                          }`}
                        >
                          {health}
                        </span>
                      </div>

                      <div className="space-y-1 my-1 text-[11px] font-mono text-zinc-400">
                        <div className="flex justify-between">
                          <span>Latency:</span>
                          <span className={node.metric?.latencyMs && node.metric.latencyMs > 1000 ? 'text-amber-400 font-bold' : 'text-zinc-200'}>
                            {node.metric?.latencyMs ?? 0} ms
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Error Rate:</span>
                          <span className={node.metric?.errorRate && node.metric.errorRate > 0 ? 'text-rose-400 font-bold' : 'text-zinc-200'}>
                            {((node.metric?.errorRate ?? 0) * 100).toFixed(0)}%
                          </span>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-zinc-800/80 text-[10px] font-mono text-zinc-500 truncate">
                        {node.desc}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Live Terminal Action Stream */}
            <div className="rounded-xl border border-zinc-800 bg-zinc-950 overflow-hidden shadow-2xl">
              <div className="bg-zinc-900/80 px-4 py-3 border-b border-zinc-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex gap-1.5 mr-2">
                    <span className="w-3 h-3 rounded-full bg-rose-500/80 inline-block" />
                    <span className="w-3 h-3 rounded-full bg-amber-500/80 inline-block" />
                    <span className="w-3 h-3 rounded-full bg-emerald-500/80 inline-block" />
                  </div>
                  <Terminal className="w-4 h-4 text-indigo-400" />
                  <span className="text-xs font-mono font-bold text-zinc-200">
                    Live Model Action & Command Telemetry Stream
                  </span>
                </div>
                <div className="text-xs font-mono text-zinc-400 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  {trajectory.length} actions captured
                </div>
              </div>

              <div className="p-4 bg-zinc-950 font-mono text-xs max-h-96 overflow-y-auto space-y-3">
                {trajectory.length === 0 ? (
                  <div className="py-12 text-center text-zinc-500">
                    <div className="animate-pulse">● Waiting for model to submit first probe or remediation call...</div>
                    <div className="text-[11px] text-zinc-600 mt-1">Actions taken via /api/agent/* will stream here live in real-time.</div>
                  </div>
                ) : (
                  trajectory.map((turn: any) => (
                    <div
                      key={turn.turn}
                      className="p-3 rounded-lg bg-zinc-900/70 border border-zinc-800/80 hover:border-zinc-700 transition-colors"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded bg-indigo-950 text-indigo-300 font-bold border border-indigo-500/30">
                            Turn {turn.turn}
                          </span>
                          <span className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 font-semibold uppercase">
                            {turn.actionType}
                          </span>
                          <span className="text-zinc-500 text-[10px]">
                            {new Date(turn.timestamp).toLocaleTimeString()}
                          </span>
                        </div>
                        <span className="text-[11px] text-zinc-400">
                          Budget Left: <b className="text-amber-300">{turn.budgetRemaining}</b>
                        </span>
                      </div>

                      {/* Payload input */}
                      <div className="bg-zinc-950/90 rounded p-2 text-zinc-300 overflow-x-auto text-[11px] border border-zinc-850">
                        <span className="text-zinc-500 select-none">$ </span>
                        {JSON.stringify(turn.input, null, 2)}
                      </div>

                      {/* Execution result snippet */}
                      {turn.output && (
                        <div className="mt-2 text-[11px] text-zinc-400">
                          <span className="text-indigo-400 font-semibold">Response: </span>
                          <span className="text-zinc-300">
                            {typeof turn.output === 'string'
                              ? turn.output
                              : turn.output.message || (turn.output.logs ? `${turn.output.logs.length} logs returned` : JSON.stringify(turn.output).slice(0, 150))}
                          </span>
                        </div>
                      )}
                    </div>
                  ))
                )}
                <div ref={terminalEndRef} />
              </div>
            </div>

            {/* Level History Breakdown (if battery completed levels) */}
            {statusData?.isBattery && statusData.battery.results?.length > 0 && (
              <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-6 shadow-xl">
                <h3 className="text-sm font-semibold text-zinc-200 mb-3 flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-amber-400" />
                  Completed Levels Transcript History
                </h3>
                <div className="space-y-2">
                  {statusData.battery.results.map((r: any) => (
                    <div
                      key={r.level}
                      className="flex items-center justify-between text-xs font-mono p-3 rounded-lg bg-zinc-900/60 border border-zinc-800"
                    >
                      <div>
                        <span className="font-bold text-zinc-200">Level {r.level}: </span>
                        <span className="text-zinc-300">{r.problemName}</span>
                        <span className="text-[10px] text-zinc-500 ml-2">({r.domain} • {r.difficulty})</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-zinc-500">{r.turnsUsed} turns</span>
                        <span className={`font-bold ${r.solved ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {r.score.total} / 1000 pts
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
}

export default function LivePage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-zinc-500 font-mono">Loading live spectator arena...</div>}>
      <LivePageContent />
    </Suspense>
  );
}
