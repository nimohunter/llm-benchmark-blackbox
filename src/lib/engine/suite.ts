import { ArchetypeId, DifficultyTier } from './types';

export interface BenchmarkProblem {
  problemNumber: number;
  id: string;
  seed: string;
  name: string;
  domain: 'Queue' | 'Storage' | 'Network' | 'Ops';
  archetypeId: ArchetypeId;
  difficulty: DifficultyTier;
  summary: string;
}

export const OFFICIAL_8_SUITE: BenchmarkProblem[] = [
  {
    problemNumber: 1,
    id: 'problem-1',
    seed: 'std-seed-q1-easy',
    name: 'Queue: Deserialization Panic',
    domain: 'Queue',
    archetypeId: 'POISON_PILL_PANIC',
    difficulty: 'tier-1',
    summary: 'Explicit stack trace in worker deserializer; missing currency key.',
  },
  {
    problemNumber: 2,
    id: 'problem-2',
    seed: 'bench-prod-402',
    name: 'Queue: Poison Pill & Red-Herring Cascade',
    domain: 'Queue',
    archetypeId: 'POISON_PILL_PANIC',
    difficulty: 'tier-2',
    summary: 'Blocked FIFO queue with injected distractor 503 log from external partner.',
  },
  {
    problemNumber: 3,
    id: 'problem-3',
    seed: 'std-seed-s3-med',
    name: 'Storage: Concurrency Lost Update',
    domain: 'Storage',
    archetypeId: 'LOST_UPDATE_CONCURRENCY',
    difficulty: 'tier-2',
    summary: 'Race condition in read-modify-write balance update during flash sale.',
  },
  {
    problemNumber: 4,
    id: 'problem-4',
    seed: 'std-seed-s4-hard',
    name: 'Storage: Silent Ledger Drift Invariant',
    domain: 'Storage',
    archetypeId: 'LOST_UPDATE_CONCURRENCY',
    difficulty: 'tier-3',
    summary: 'System returns 200 OK with no crash logs; balance drift only revealed via audit.',
  },
  {
    problemNumber: 5,
    id: 'problem-5',
    seed: 'std-seed-n5-med',
    name: 'Network: Timeout & DB Pool Starvation',
    domain: 'Network',
    archetypeId: 'TIMEOUT_POOL_STARVATION',
    difficulty: 'tier-2',
    summary: 'Slow external provider holds DB transaction locks, exhausting pool (100/100).',
  },
  {
    problemNumber: 6,
    id: 'problem-6',
    seed: 'std-seed-n6-hard',
    name: 'Network: Cascading Timeout Starvation',
    domain: 'Network',
    archetypeId: 'TIMEOUT_POOL_STARVATION',
    difficulty: 'tier-3',
    summary: 'Cascading gateway 504 and pool exhaustion under high concurrent order traffic.',
  },
  {
    problemNumber: 7,
    id: 'problem-7',
    seed: 'std-seed-o7-med',
    name: 'Ops: Vault Token Rotation Desync',
    domain: 'Ops',
    archetypeId: 'AUTH_TOKEN_ROTATION_DESYNC',
    difficulty: 'tier-2',
    summary: 'Expired bearer token cached in worker static memory after Vault rotation.',
  },
  {
    problemNumber: 8,
    id: 'problem-8',
    seed: 'std-seed-o8-hard',
    name: 'Ops: Secret Desync & Cross-Service Lockout',
    domain: 'Ops',
    archetypeId: 'AUTH_TOKEN_ROTATION_DESYNC',
    difficulty: 'tier-3',
    summary: 'Full authentication rejection across all worker threads under traffic burst.',
  },
];

export function getProblemByNumber(num: number): BenchmarkProblem | undefined {
  return OFFICIAL_8_SUITE.find((p) => p.problemNumber === num);
}
