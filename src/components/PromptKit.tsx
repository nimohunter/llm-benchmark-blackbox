'use client';

import React, { useState } from 'react';
import { Copy, Check, Terminal, Play, Sparkles, Trophy, Target, ShieldAlert } from 'lucide-react';

interface PromptKitProps {
  onSessionCreated?: (sessionData: any) => void;
}

export const PromptKit: React.FC<PromptKitProps> = ({ onSessionCreated }) => {
  const [examMode, setExamMode] = useState<'survival' | 'single'>('survival');
  const [modelName, setModelName] = useState('Claude Opus 5');
  const [seed, setSeed] = useState('std-seed-q1-easy');
  const [archetype, setArchetype] = useState('prob-1');
  const [difficulty, setDifficulty] = useState('tier-1');
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [createdSession, setCreatedSession] = useState<any>(null);

  // 1. Single Problem Creation Handler
  const handleCreateSingle = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/session/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model_name: modelName,
          seed,
          problem_preset: archetype,
          difficulty,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setCreatedSession(data);
        if (onSessionCreated) onSessionCreated(data);
      }
    } catch (err) {
      console.error('Failed to create single session', err);
    } finally {
      setLoading(false);
    }
  };

  // 2. Full 8-Level Survival Battery Creation Handler
  const handleCreateSurvival = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/battery/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model_name: modelName || 'Anonymous-Model' }),
      });
      const data = await res.json();
      if (data.success) {
        setCreatedSession({
          session_id: data.battery_id,
          is_battery: true,
          master_prompt: data.master_prompt,
        });
        if (onSessionCreated) onSessionCreated(data);
      }
    } catch (err) {
      console.error('Failed to create survival battery', err);
    } finally {
      setLoading(false);
    }
  };

  const benchmarkPrompt = createdSession
    ? createdSession.is_battery
      ? createdSession.master_prompt
      : `You are an expert Autonomous Site Reliability Engineer evaluating on the BlackBox-Ops Benchmark.
A critical incident has degraded the production system. Your goal is to diagnose the root cause, dry-run a safe fix on staging, apply it to production, and submit your Root Cause Analysis.

Target API: ${typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000'}
Session ID: ${createdSession.session_id}
Turn Budget: ${createdSession.budget_remaining} units

RULES OF ENGAGEMENT & INTEGRITY POLICY:
1. All queries and remediations must strictly interact with /api/agent/* REST endpoints.
2. Scraping static frontend assets (/_next/*) or querying internal dashboard endpoints is strictly forbidden. Out-of-band scraping triggers immediate disqualification (Score: 0).

Instructions:
1. GET /api/agent/brief/${createdSession.session_id} to read the incident alert, topology, and tools.
2. POST /api/agent/probe with {"session_id": "${createdSession.session_id}", "tool": "get_logs", "params": {"service": "worker", "limit": 20}} to inspect logs.
3. Formulate your hypothesis. Always test via POST /api/agent/dryrun before applying!
4. Apply the fix via POST /api/agent/apply with your typed remediation (CONFIG_UPDATE, SERVICE_ACTION, or RUN_SQL).
5. Conclude by calling POST /api/agent/finish with:
   {
     "session_id": "${createdSession.session_id}",
     "root_cause_service": "<service>",
     "failure_category": "<concise incident category: e.g. POISON_PILL, CONCURRENCY_RACE, TIMEOUT_STARVATION, or AUTH_DESYNC>",
     "triggering_condition": "<concise explanation of bug trigger>"
   }

Begin now by fetching the incident brief.`
    : 'Choose your benchmark mode above and generate a prompt.';

  const handleCopy = () => {
    navigator.clipboard.writeText(benchmarkPrompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-6 shadow-xl">
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-zinc-800">
        <div className="flex items-center gap-2.5">
          <Sparkles className="w-5 h-5 text-amber-400" />
          <div>
            <h3 className="text-base font-semibold text-zinc-100">
              Model Evaluation Kit & Prompt Generator
            </h3>
            <p className="text-xs text-zinc-400">
              Select your testing mode below to generate an evaluation prompt for Claude, Gemini, or any LLM.
            </p>
          </div>
        </div>

        {/* Clear Mode Switcher */}
        <div className="flex items-center bg-zinc-900 p-1 rounded-lg border border-zinc-800 text-xs">
          <button
            onClick={() => { setExamMode('survival'); setCreatedSession(null); }}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-md font-medium transition-all ${
              examMode === 'survival'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Trophy className="w-3.5 h-3.5" />
            10-Level Grandmaster Exam (All 10)
          </button>
          <button
            onClick={() => { setExamMode('single'); setCreatedSession(null); }}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-md font-medium transition-all ${
              examMode === 'single'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Target className="w-3.5 h-3.5" />
            Single Problem Practice
          </button>
        </div>
      </div>

      {/* MODE 1: 10-LEVEL SURVIVAL EXAM */}
      {examMode === 'survival' && (
        <div className="space-y-4 mb-6">
          <div className="p-4 rounded-xl bg-gradient-to-r from-indigo-950/40 via-zinc-900 to-zinc-950 border border-indigo-500/30 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-bold uppercase">
                  Grandmaster SRE Evaluation
                </span>
                <span className="text-sm font-semibold text-zinc-100">
                  The Continuous 10-Level Survival Ladder
                </span>
              </div>
              <p className="text-xs text-zinc-400 max-w-2xl leading-relaxed">
                You will copy <b>1 Master Prompt</b>. The model autonomously solves Level 1 through Level 10 in sequence within a single chat. If the model fails any level or triggers a blast radius, it is knocked out immediately!
              </p>
              <div className="flex items-center gap-3 text-[11px] font-mono text-zinc-500 pt-1">
                <span>✓ L1 (Easy) to L10 (Nightmare Boss)</span>
                <span>•</span>
                <span>✓ 10 Unique Failure Archetypes</span>
                <span>•</span>
                <span>✓ Blast Radius Traps</span>
              </div>
            </div>

            <div className="min-w-[280px]">
              <label className="block text-xs font-mono text-zinc-300 mb-1.5 font-medium">
                Evaluated Model Name:
              </label>
              <input
                type="text"
                value={modelName}
                onChange={(e) => setModelName(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-zinc-900 border border-zinc-700 rounded-lg text-zinc-100 focus:outline-none focus:border-indigo-500 mb-3"
                placeholder="e.g. Claude Opus 5, Gemini 3.8 Flash"
              />
              <button
                onClick={handleCreateSurvival}
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold shadow-lg shadow-indigo-600/25 transition-all disabled:opacity-50"
              >
                <Play className="w-4 h-4 fill-white" />
                {loading ? 'Initializing Exam...' : 'Generate 10-Level Exam Prompt'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODE 2: SINGLE PROBLEM PRACTICE */}
      {examMode === 'single' && (
        <div className="space-y-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-mono text-zinc-400 mb-1.5 font-medium">
                Evaluated Model Name
              </label>
              <input
                type="text"
                value={modelName}
                onChange={(e) => setModelName(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-zinc-900 border border-zinc-700 rounded-lg text-zinc-100 focus:outline-none focus:border-indigo-500"
                placeholder="e.g. Claude Opus 5, Gemini 3.8 Flash"
              />
            </div>

            <div>
              <label className="block text-xs font-mono text-zinc-400 mb-1.5 font-medium">
                Choose Practice Problem (Isolated Single Test)
              </label>
              <select
                value={archetype}
                onChange={(e) => {
                  const val = e.target.value;
                  setArchetype(val);
                  if (val === 'prob-1') { setSeed('std-seed-q1-easy'); setDifficulty('tier-1'); }
                  else if (val === 'prob-2') { setSeed('std-seed-o7-med'); setDifficulty('tier-2'); }
                  else if (val === 'prob-3') { setSeed('std-seed-s3-med'); setDifficulty('tier-2'); }
                  else if (val === 'prob-4') { setSeed('std-seed-n5-med'); setDifficulty('tier-2'); }
                  else if (val === 'prob-5') { setSeed('std-seed-c5-hard'); setDifficulty('tier-3'); }
                  else if (val === 'prob-6') { setSeed('std-seed-r6-hard'); setDifficulty('tier-3'); }
                  else if (val === 'prob-7') { setSeed('std-seed-d7-hard'); setDifficulty('tier-3'); }
                  else if (val === 'prob-8') { setSeed('std-seed-b8-nightmare'); setDifficulty('tier-4'); }
                  else if (val === 'prob-9') { setSeed('std-seed-p9-nightmare'); setDifficulty('tier-4'); }
                  else if (val === 'prob-10') { setSeed('std-seed-x10-nightmare-boss'); setDifficulty('tier-4'); }
                }}
                className="w-full px-3 py-2 text-sm bg-zinc-900 border border-zinc-700 rounded-lg text-zinc-100 focus:outline-none focus:border-indigo-500 font-mono"
              >
                <option value="prob-1">Level 1: Queue Deserialization Panic (Tier 1)</option>
                <option value="prob-2">Level 2: Vault Token Rotation Desync (Tier 2)</option>
                <option value="prob-3">Level 3: Storage Concurrency Lost Update (Tier 2)</option>
                <option value="prob-4">Level 4: Cascading Timeout & DB Pool Starvation (Tier 2)</option>
                <option value="prob-5">Level 5: Cache Stampede & Thundering Herd (Tier 3)</option>
                <option value="prob-6">Level 6: Memory Leak & Runaway GC Cascade (Tier 3)</option>
                <option value="prob-7">Level 7: Distributed Saga Circular Deadlock (Tier 3)</option>
                <option value="prob-8">Level 8: Byzantine NTP Clock Skew & Token Drift (Tier 4)</option>
                <option value="prob-9">Level 9: Split-Brain Asymmetric Consensus Partition (Tier 4)</option>
                <option value="prob-10">Level 10: Silent Schema Drift & Ledger Poisoning (Tier 4 Boss)</option>
              </select>
              <p className="text-[11px] text-zinc-500 font-mono mt-1">
                Preset Seed: <code className="text-zinc-300">{seed}</code> | Difficulty: <code className="text-zinc-300 uppercase">{difficulty}</code>
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <button
              onClick={handleCreateSingle}
              disabled={loading}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white text-sm font-medium border border-zinc-700 transition-all disabled:opacity-50"
            >
              <Play className="w-4 h-4 fill-zinc-300" />
              {loading ? 'Initializing Practice...' : 'Generate Single Problem Prompt'}
            </button>

            <div className="text-xs font-mono text-zinc-400 flex items-center gap-2">
              <span>Run via CLI:</span>
              <code className="bg-zinc-950 px-2.5 py-1 rounded border border-zinc-800 text-indigo-300">
                python3 evaluate.py --model &quot;{modelName || 'Model'}&quot; --suite standard
              </code>
            </div>
          </div>
        </div>
      )}

      {/* GENERATED PROMPT PREVIEW & 1-CLICK COPY */}
      {createdSession && (
        <div className="relative rounded-xl border border-indigo-500/30 bg-zinc-900/80 p-5 mt-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 text-xs font-mono text-zinc-300">
              <Terminal className="w-4 h-4 text-indigo-400" />
              <span>
                {createdSession.is_battery
                  ? 'Master 8-Level Exam Prompt (Copy into LLM Chat)'
                  : 'Single Problem Drill Prompt (Copy into LLM Chat)'}
              </span>
              <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-500/30 text-[10px]">
                ID: {createdSession.session_id}
              </span>
            </div>
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/20 transition-all"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copied to Clipboard!' : 'Copy Master Prompt'}
            </button>
          </div>
          <pre className="text-xs font-mono text-zinc-200 bg-zinc-950 p-4 rounded-lg border border-zinc-800/80 whitespace-pre-wrap max-h-72 overflow-y-auto leading-relaxed">
            {benchmarkPrompt}
          </pre>
        </div>
      )}
    </div>
  );
};
