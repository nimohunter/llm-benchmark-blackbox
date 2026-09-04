'use client';

import React from 'react';
import { ServiceHealth, ServiceMetrics } from '@/lib/engine/types';
import { Activity, Database, Globe, Layers, Server, ShieldAlert } from 'lucide-react';

interface TopologyMapProps {
  metrics: Record<string, ServiceMetrics>;
  modelName?: string;
  sessionId?: string;
}

export const TopologyMap: React.FC<TopologyMapProps> = ({ metrics, modelName, sessionId }) => {
  const getStatusBadge = (health?: ServiceHealth) => {
    switch (health) {
      case 'HEALTHY':
        return {
          bg: 'bg-emerald-950/60 border-emerald-500/30 text-emerald-400',
          dot: 'bg-emerald-500',
          text: 'Healthy',
        };
      case 'DEGRADED':
        return {
          bg: 'bg-amber-950/60 border-amber-500/30 text-amber-400',
          dot: 'bg-amber-500 animate-pulse',
          text: 'Degraded',
        };
      case 'DOWN':
        return {
          bg: 'bg-rose-950/60 border-rose-500/30 text-rose-400',
          dot: 'bg-rose-500 animate-ping',
          text: 'Down',
        };
      default:
        return {
          bg: 'bg-zinc-800 border-zinc-700 text-zinc-400',
          dot: 'bg-zinc-500',
          text: 'Unknown',
        };
    }
  };

  const nodes = [
    {
      id: 'gateway',
      name: 'API Gateway',
      icon: <Globe className="w-5 h-5" />,
      metric: metrics.gateway,
      desc: 'Ingestion & Rate Limit',
    },
    {
      id: 'queue',
      name: 'Event Queue',
      icon: <Layers className="w-5 h-5" />,
      metric: metrics.queue,
      desc: `Depth: ${metrics.queue?.queueDepth ?? 0} msgs`,
    },
    {
      id: 'worker',
      name: 'Worker Service',
      icon: <Server className="w-5 h-5" />,
      metric: metrics.worker,
      desc: 'Consumer & Business Logic',
    },
    {
      id: 'external',
      name: 'External Partner',
      icon: <Activity className="w-5 h-5" />,
      metric: metrics.external,
      desc: '3rd-Party Payment & Vendor',
    },
    {
      id: 'db',
      name: 'Audit DB',
      icon: <Database className="w-5 h-5" />,
      metric: metrics.db,
      desc: `Pool: ${metrics.db?.connectionPoolUsed ?? 0}/100`,
    },
  ];

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950/80 p-6 backdrop-blur shadow-xl">
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-zinc-800/80">
        <div>
          <h3 className="text-base font-semibold text-zinc-100 flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-indigo-400" />
            Live System Architecture Topology
            {modelName ? (
              <span className="text-xs font-mono font-normal px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Target Environment: <b className="text-white font-semibold">{modelName}</b>
              </span>
            ) : (
              <span className="text-xs font-mono font-normal px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400">
                Preview Mode
              </span>
            )}
          </h3>
          <p className="text-xs text-zinc-400 mt-0.5">
            {sessionId ? (
              <>Observing live microservice metrics for isolated session: <code className="text-zinc-200 font-mono">{sessionId}</code></>
            ) : (
              'Real-time simulated telemetry across distributed pipeline'
            )}
          </p>
        </div>
        <span className="text-xs font-mono px-2.5 py-1 rounded-full bg-zinc-900 text-zinc-400 border border-zinc-800">
          5-Node Isolated Mesh
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 relative">
        {nodes.map((node) => {
          const badge = getStatusBadge(node.metric?.health);
          return (
            <div
              key={node.id}
              className={`rounded-lg border p-4 transition-all ${badge.bg} flex flex-col justify-between`}
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="p-2 rounded-md bg-zinc-900/80 text-zinc-200">
                    {node.icon}
                  </div>
                  <div className="flex items-center gap-1.5 text-xs font-mono font-medium">
                    <span className={`w-2 h-2 rounded-full ${badge.dot}`} />
                    {badge.text}
                  </div>
                </div>
                <h4 className="font-semibold text-sm text-zinc-100">{node.name}</h4>
                <p className="text-xs text-zinc-400 mt-0.5">{node.desc}</p>
              </div>

              <div className="mt-4 pt-3 border-t border-zinc-800/80 flex items-center justify-between text-xs font-mono text-zinc-400">
                <span>{node.metric?.latencyMs ?? 0}ms</span>
                <span>Err: {((node.metric?.errorRate ?? 0) * 100).toFixed(0)}%</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
