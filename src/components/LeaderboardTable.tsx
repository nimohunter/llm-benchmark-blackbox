'use client';

import React, { useEffect, useState } from 'react';
import { Trophy, CheckCircle2, XCircle, Eye, RefreshCw, Crown, Target, Filter } from 'lucide-react';
import { LeaderboardEntry } from '@/lib/storage';

interface LeaderboardTableProps {
  onSelectReplay?: (sessionId: string) => void;
}

export const LeaderboardTable: React.FC<LeaderboardTableProps> = ({ onSelectReplay }) => {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [division, setDivision] = useState<'ladder' | 'practice'>('ladder');
  const [domainFilter, setDomainFilter] = useState<string>('ALL');
  const [loading, setLoading] = useState(false);

  const fetchLeaderboard = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/leaderboard');
      const data = await res.json();
      if (data.success) {
        setEntries(data.leaderboard);
        const hasLadder = data.leaderboard.some((e: any) => e.isLadder);
        const hasPractice = data.leaderboard.some((e: any) => !e.isLadder);
        if (!hasLadder && hasPractice) {
          setDivision('practice');
        }
      }
    } catch (err) {
      console.error('Failed to load leaderboard', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaderboard();
  }, []);

  const ladderEntries = entries.filter((e) => e.isLadder);
  // Sort ladder entries by levelsCleared descending, then totalScore descending
  ladderEntries.sort((a, b) => {
    const aCleared = a.levelsCleared ?? (a.solved ? 8 : 0);
    const bCleared = b.levelsCleared ?? (b.solved ? 8 : 0);
    if (bCleared !== aCleared) return bCleared - aCleared;
    return b.totalScore - a.totalScore;
  });

  const practiceEntries = entries.filter((e) => !e.isLadder);
  const filteredPractice = practiceEntries.filter((e) => {
    if (domainFilter === 'ALL') return true;
    return (e.domain || '').toUpperCase() === domainFilter;
  });

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950 overflow-hidden shadow-xl">
      {/* Header & Division Switcher */}
      <div className="p-5 border-b border-zinc-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Trophy className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-zinc-100 text-base">Global Benchmarking Leaderboard</h3>
            <p className="text-xs text-zinc-400">
              Official standardized rankings separated from isolated practice drills.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Division Tabs */}
          <div className="flex items-center bg-zinc-900 p-1 rounded-lg border border-zinc-800 text-xs">
            <button
              onClick={() => setDivision('ladder')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-md font-medium transition-all ${
                division === 'ladder'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Crown className="w-3.5 h-3.5" />
              8-Level Survival Ladder ({ladderEntries.length})
            </button>
            <button
              onClick={() => setDivision('practice')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-md font-medium transition-all ${
                division === 'practice'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Target className="w-3.5 h-3.5" />
              Single Practice Drills ({practiceEntries.length})
            </button>
          </div>

          <button
            onClick={fetchLeaderboard}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 bg-zinc-900 border border-zinc-800 rounded-md transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* DIVISION 1: 8-LEVEL SURVIVAL LADDER (CHAMPIONSHIP) */}
      {division === 'ladder' && (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-zinc-900/80 text-zinc-400 font-mono border-b border-zinc-800">
              <tr>
                <th className="py-3 px-4">Rank</th>
                <th className="py-3 px-4">Model Name</th>
                <th className="py-3 px-4">Levels Cleared</th>
                <th className="py-3 px-4">Composite Score</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Recovery (400)</th>
                <th className="py-3 px-4">RCA (250)</th>
                <th className="py-3 px-4">Safety (200)</th>
                <th className="py-3 px-4">Efficiency (150)</th>
                <th className="py-3 px-4">Total Turns</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60 text-zinc-300">
              {ladderEntries.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-zinc-500 font-mono">
                    No 8-Level Survival Ladder runs submitted yet.
                    <p className="text-xs text-zinc-600 mt-1">
                      Start an exam in <b>Model Evaluation Kit</b> &rarr; <b>8-Level Survival Exam</b>.
                    </p>
                  </td>
                </tr>
              ) : (
                ladderEntries.map((entry, idx) => {
                  const isGrandmaster = entry.levelsCleared === 8 || entry.seed === 'ladder-grandmaster-all8';
                  const cleared = entry.levelsCleared ?? (isGrandmaster ? 8 : 1);
                  return (
                    <tr key={entry.sessionId} className="hover:bg-zinc-900/40 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-zinc-400">
                        {idx === 0 ? '🥇 #1' : idx === 1 ? '🥈 #2' : idx === 2 ? '🥉 #3' : `#${idx + 1}`}
                      </td>
                      <td className="py-3 px-4 font-medium text-zinc-100 flex flex-col">
                        <span className="font-semibold text-sm">{entry.modelName}</span>
                        <span className="text-[10px] font-mono text-zinc-500">{entry.seed}</span>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-2.5 py-1 rounded-md text-xs font-mono font-bold border ${
                          isGrandmaster
                            ? 'bg-amber-950/60 text-amber-300 border-amber-500/40'
                            : cleared > 0
                            ? 'bg-emerald-950/60 text-emerald-300 border-emerald-500/40'
                            : 'bg-rose-950/60 text-rose-300 border-rose-500/40'
                        }`}>
                          {isGrandmaster ? '8/8 Cleared 🏆' : `Level ${cleared}/8 Cleared`}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex flex-col">
                          <div>
                            <span className="font-mono font-bold text-indigo-400 text-base">
                              {entry.totalScore}
                            </span>
                            <span className="text-zinc-500 font-mono"> / 1000</span>
                          </div>
                          {entry.levelsCleared !== undefined && entry.levelsCleared < 8 && (
                            <span className="text-[10px] font-mono text-zinc-500">
                              (scaled / 8 levels)
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        {isGrandmaster ? (
                          <span className="inline-flex items-center gap-1 text-emerald-400 font-medium">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Grandmaster
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-rose-400 font-medium font-mono">
                            <XCircle className="w-3.5 h-3.5" /> Knocked Out @ L{cleared + 1}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 font-mono">{entry.recovery}</td>
                      <td className="py-3 px-4 font-mono">{entry.rcaAccuracy}</td>
                      <td className="py-3 px-4 font-mono">{entry.safety}</td>
                      <td className="py-3 px-4 font-mono">{entry.efficiency}</td>
                      <td className="py-3 px-4 font-mono">{entry.turnsUsed}</td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => onSelectReplay && onSelectReplay(entry.sessionId)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition-colors"
                        >
                          <Eye className="w-3 h-3 text-indigo-400" /> Replay
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* DIVISION 2: SINGLE PROBLEM PRACTICE DRILLS */}
      {division === 'practice' && (
        <div>
          {/* Domain Filter Bar */}
          <div className="px-5 py-2.5 bg-zinc-900/40 border-b border-zinc-800 flex items-center gap-2 text-xs font-mono">
            <span className="text-zinc-500 flex items-center gap-1">
              <Filter className="w-3 h-3" /> Filter Domain:
            </span>
            {['ALL', 'QUEUE', 'STORAGE', 'NETWORK', 'OPS'].map((dom) => (
              <button
                key={dom}
                onClick={() => setDomainFilter(dom)}
                className={`px-2.5 py-1 rounded transition-colors ${
                  domainFilter === dom
                    ? 'bg-zinc-800 text-indigo-300 font-semibold border border-zinc-700'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {dom}
              </button>
            ))}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-900/80 text-zinc-400 font-mono border-b border-zinc-800">
                <tr>
                  <th className="py-3 px-4">Rank</th>
                  <th className="py-3 px-4">Model Name</th>
                  <th className="py-3 px-4">Practice Scenario</th>
                  <th className="py-3 px-4">Tier</th>
                  <th className="py-3 px-4">Drill Score</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Recovery</th>
                  <th className="py-3 px-4">RCA</th>
                  <th className="py-3 px-4">Safety</th>
                  <th className="py-3 px-4">Efficiency</th>
                  <th className="py-3 px-4">Turns</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60 text-zinc-300">
                {filteredPractice.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="py-12 text-center text-zinc-500 font-mono">
                      No practice drill sessions recorded for this domain.
                    </td>
                  </tr>
                ) : (
                  filteredPractice.map((entry, idx) => {
                    const badgeClass = entry.badgeColor || 'bg-zinc-800 text-zinc-300 border-zinc-700';
                    const scenarioTitle = entry.scenarioName || 'Drill Scenario';
                    const domainLabel = entry.domain || 'Incident';
                    return (
                      <tr key={entry.sessionId} className="hover:bg-zinc-900/40 transition-colors">
                        <td className="py-3 px-4 font-mono font-bold text-zinc-400">
                          {idx === 0 ? '🥇 #1' : idx === 1 ? '🥈 #2' : idx === 2 ? '🥉 #3' : `#${idx + 1}`}
                        </td>
                        <td className="py-3 px-4 font-medium text-zinc-100 flex flex-col">
                          <span>{entry.modelName}</span>
                          <span className="text-[10px] font-mono text-zinc-500">Seed: {entry.seed}</span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex flex-col gap-1 items-start">
                            <span className={`px-2 py-0.5 rounded text-[11px] font-mono border ${badgeClass}`}>
                              {scenarioTitle}
                            </span>
                            <span className="text-[10px] text-zinc-500 font-mono">Domain: {domainLabel}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4 font-mono">
                          <span className="px-2 py-0.5 rounded text-[11px] uppercase bg-zinc-800 text-zinc-300 border border-zinc-700">
                            {entry.difficulty.replace('tier-', 'T')}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span className="font-mono font-bold text-indigo-400 text-sm">
                            {entry.totalScore}
                          </span>
                          <span className="text-zinc-500"> / 1000</span>
                        </td>
                        <td className="py-3 px-4">
                          {entry.solved ? (
                            <span className="inline-flex items-center gap-1 text-emerald-400 font-medium">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Solved
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-rose-400 font-medium">
                              <XCircle className="w-3.5 h-3.5" /> Failed
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 font-mono">{entry.recovery}</td>
                        <td className="py-3 px-4 font-mono">{entry.rcaAccuracy}</td>
                        <td className="py-3 px-4 font-mono">{entry.safety}</td>
                        <td className="py-3 px-4 font-mono">{entry.efficiency}</td>
                        <td className="py-3 px-4 font-mono">{entry.turnsUsed}</td>
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() => onSelectReplay && onSelectReplay(entry.sessionId)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition-colors"
                          >
                            <Eye className="w-3 h-3 text-indigo-400" /> Replay
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
