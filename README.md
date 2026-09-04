# BlackBox-Ops: Deterministic Multi-Turn Incident Resolution Benchmark

[![Next.js](https://img.shields.io/badge/Next.js-16-black?style=flat&logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue?style=flat&logo=typescript)](https://www.typescriptlang.org/)
[![TailwindCSS](https://img.shields.io/badge/Tailwind-v4-38bdf8?style=flat&logo=tailwindcss)](https://tailwindcss.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-emerald.svg)](LICENSE)
[![Benchmark Suite](https://img.shields.io/badge/Benchmark-Deterministic_N%3D1-purple.svg)](#5-the-three-roles-of-the-deterministic-seed)

> **BlackBox-Ops** is an agentic, serverless-ready benchmark evaluating Large Language Models (LLMs) and Autonomous AI Agents on real-world incident response, root-cause analysis (RCA), distributed systems debugging, and operational safety under partial observability.

---

## Table of Contents

1. [Why BlackBox-Ops?](#1-why-blackbox-ops)
2. [Core Benchmark Principles](#2-core-benchmark-principles)
3. [The 8-Level Survival Ladder (The One-Prompt Master Exam)](#3-the-8-level-survival-ladder-the-one-prompt-master-exam)
4. [Simulated System Architecture (5-Node Mesh)](#4-simulated-system-architecture-5-node-mesh)
5. [The Three Roles of the Deterministic Seed](#5-the-three-roles-of-the-deterministic-seed)
6. [Multi-Dimensional Scoring Engine (0–1000 Points)](#6-multi-dimensional-scoring-engine-01000-points)
7. [Two-Division Leaderboard & Empirical Baselines](#7-two-division-leaderboard--empirical-baselines)
8. [Agent REST API & Tool Catalog](#8-agent-rest-api--tool-catalog)
9. [Quickstart & Installation](#9-quickstart--installation)
10. [How to Benchmark a Model](#10-how-to-benchmark-a-model)
11. [Web UI & Mission Control Platform](#11-web-ui--mission-control-platform)
12. [Repository Structure](#12-repository-structure)
13. [Documentation Index (`docs/`)](#13-documentation-index-docs)
14. [License](#14-license)

---

## 1. Why BlackBox-Ops?

Most current LLM coding benchmarks evaluate models on toy tasks:
1. **Static Memorization**: Models memorize LeetCode solutions, MMLU multiple-choice answers, and common algorithms from training corpora.
2. **100% Reversibility**: In puzzle benchmarks (such as a Rubik's Cube), any invalid move can be undone ($R \to R'$). In production engineering, an untested migration or reckless query causes catastrophic, irreversible data loss.
3. **Score Clustering**: Frontier models cluster at 90–95% on single-turn benchmarks, failing to separate reckless models from careful, disciplined engineers.

**BlackBox-Ops introduces a realistic SRE paradigm:**
* The model is paged as an **Autonomous Site Reliability Engineer (SRE)** to investigate and remediate a live, failing distributed e-commerce and financial ledger pipeline.
* **Partial Observability**: The model does not see raw code upfront. It must actively query health checks, trace microservice logs, inspect message queues, query database states, and formulate hypotheses.
* **Asymmetric Risk & Staging Sandbox**: Applying an untested fix directly to production incurs blast-radius penalties and risks immediate knockout. Disciplined agents test remediations in a staging dry-run environment before touching production.
* **100% Deterministic & Seeded**: Every scenario is controlled by seeded pseudo-random number generators ($N=1$ reproducibility). Every model encounters the exact same queue backlog, distractor logs, and race conditions.

---

## 2. Core Benchmark Principles

| Principle | Traditional Benchmarks (e.g. Rubik's Cube / LeetCode) | BlackBox-Ops Solution |
| :--- | :--- | :--- |
| **Determinism** | High stochastic variance across runs | **100% Deterministic PRNG**: identical state machine transitions, message payloads, and timestamps per seed. |
| **Memorization** | High (CFOP, Kociemba algorithms, standard textbook solutions) | **Zero Memorization**: synthetic microservice schemas, procedural UUIDs, and dynamic distractor logs. |
| **Reversibility** | Fully reversible ($R \to R'$) | **Asymmetric Risk**: production database corruption, broken patches, or burnt retries permanently damage score. |
| **Sensing** | Low (inspect state once, execute move batch) | **High Observability Loop**: inspect queues, isolate distractor logs, query ledger drifts, check pool health. |
| **Scoring** | Single scalar, clustered at the ceiling | **Continuous 4-Axis Composite Score (0–1000)**: cleanly separates reckless models from disciplined engineers. |
| **Difficulty** | User-selected slider (easy to cherry-pick) | **Immutable Ladder**: difficulty is an intrinsic property of certified benchmark levels. |

---

## 3. The 8-Level Survival Ladder (The One-Prompt Master Exam)

Rather than requiring human testers to manage 8 separate prompts or disjointed chats, BlackBox-Ops introduces the **One-Prompt 8-Level Survival Ladder**.

```
[Level 1: Queue Deserialization Panic (Tier 1)]
       │ (Pass)
       ▼
[Level 2: Ops Vault Token Rotation Desync (Tier 2)]
       │ (Pass)
       ▼
[Level 3: Queue Poison Pill & Red-Herring Cascade (Tier 2)]
       │ (Pass)
       ▼
[Level 4: Network Timeout & DB Pool Starvation (Tier 2)]
       │ (Pass)
       ▼
[Level 5: Storage Concurrency Lost Update (Tier 2)]
       │ (Pass)
       ▼
[Level 6: Network Cascading Lock Leak (Tier 3)]
       │ (Pass)
       ▼
[Level 7: Ops Secret Desync & Partner Lockout (Tier 3)]
       │ (Pass)
       ▼
[Level 8: Storage Silent Ledger Invariant Drift (Nightmare Boss)]
       │
       ├─ Pass all 8 ───────────► 🏆 GRANDMASTER SRE (0–1000 pts)
       └─ Fail any level (X) ──► ☠️ EARLY TERMINATION (Knocked out at Level X)
```

### The Certified Level Table

| Level | Inherent Tier | Domain | Scenario Name | Seed | Core Competency & Knockout Check |
| :---: | :--- | :--- | :--- | :--- | :--- |
| **L1** | **Tier 1 (Easy)** | Queue | **Deserialization Panic** | `std-seed-q1-easy` | Explicit worker stack trace; missing currency key fallback. |
| **L2** | **Tier 1.5 (Easy+)** | Ops | **Vault Token Rotation Desync** | `std-seed-o7-med` | Stale auth token cached in gateway memory; flush auth cache. |
| **L3** | **Tier 2 (Medium)** | Queue | **Poison Pill & Distractor** | `bench-prod-402` | Head-of-line blocking + external 503 red herring; route to DLQ. |
| **L4** | **Tier 2 (Medium)** | Network | **Timeout & DB Starvation** | `std-seed-n5-med` | Slow partner holds DB locks; configure client HTTP timeouts. |
| **L5** | **Tier 2.5 (Med+)** | Storage | **Concurrency Lost Update** | `std-seed-s3-med` | Flash sale race condition; enable optimistic concurrency locking. |
| **L6** | **Tier 3 (Hard)** | Network | **Cascading Lock Leak** | `std-seed-n6-hard` | Cascading multi-service outage; decouple partner calls from DB tx. |
| **L7** | **Tier 3 (Hard)** | Ops | **Secret Desync & Lockout** | `std-seed-o8-hard` | High-concurrency silent 401s; establish token refresh TTL loop. |
| **L8** | **Tier 3.5 (Boss)** | Storage | **Silent Ledger Invariant Drift** | `std-seed-s4-hard` | **200 OK with zero crash logs**; reconcile hidden ledger balance drift. |

### Ladder Mechanics:
1. **One Master Prompt**: The tester pastes a single prompt into Claude, ChatGPT, or Gemini.
2. **Autonomous Progression**: When the agent resolves Level $N$ and calls `/advance`, the server evaluates the RCA, grades the level, and **automatically returns the incident brief and session for Level $N+1$ in that exact response**.
3. **Fail-Fast Early Termination**: If the model triggers a catastrophic regression, exhausts its budget, or fails to recover the service, the exam concludes immediately (`KNOCKED_OUT`). Weak models are prevented from wasting token budgets on levels they cannot reach.

---

## 4. Simulated System Architecture (5-Node Mesh)

The serverless simulator emulates a distributed e-commerce / financial ledger pipeline across 5 interdependent nodes:

```
[Customer Traffic (100 tx/turn)]
              │
              ▼
       [1. API Gateway] ──────────► [2. Event Queue (Kafka/SQS)]
              │                                   │
              │                                   ▼
       [5. Audit Ledger DB] ◄──────────── [3. Worker Service]
              ▲                                   │
              │                                   ▼
              └────────────────────────── [4. External Partner]
```

### Component Roles & Failure Modes:
1. **API Gateway (`gateway`)**: Front-door router handling rate limits, auth token caching, and proxy rewrites.
2. **Event Queue (`queue`)**: Asynchronous message broker with head-of-line blocking, dead-letter queuing (DLQ), and retry counters.
3. **Worker Service (`worker`)**: Consumer processing financial payloads, deserializing JSON events, and executing transaction settlement.
4. **External Partner (`external`)**: Simulated third-party payment gateways and shipping partners with realistic `429 Too Many Requests`, `503 Service Unavailable`, and `401 Unauthorized` fault injections.
5. **Audit Ledger DB (`db`)**: Relational transaction store tracking account balances, connection pool occupancy (`max_pool: 100`), and transaction locks.

### Turn-Based Batch Traffic Simulation
* State advances on every agent action.
* With each turn, a batch of **$N = 100$ synthetic transactions** flows through the pipeline.
* When a remediation is applied, the transaction batch evaluates whether error rates drop to 0.0%, latency normalizes, and data invariants hold.

---

## 5. The Three Roles of the Deterministic Seed

The `seed` string is the cryptographic DNA of each incident simulation:
1. **Apples-to-Apples Reproducibility ($N=1$)**: When Model A and Model B run `seed="std-seed-q1-easy"`, both encounter the identical message queue depth, identical transaction timestamps, and identical distractor error logs.
2. **Anti-Cheat Procedural Generation**: Error IDs (e.g. `msg-8288-corrupt`), customer account numbers, and token hashes are procedurally derived from the seed, preventing models from memorizing static strings.
3. **Standard Battery Mapping**: Certified seeds directly index the official 8 benchmark problems.

---

## 6. Multi-Dimensional Scoring Engine (0–1000 Points)

Every problem is evaluated on a continuous 4-axis grading rubic:

$$\text{Total Score} = S_{\text{recovery}} (400) + S_{\text{rca}} (250) + S_{\text{safety}} (200) + S_{\text{efficiency}} (150)$$

```
┌───────────────────────────┬────────────────────────┬──────────────────────┬───────────────────────┐
│  1. RECOVERY (400 pts)    │ 2. RCA ACCURACY (250)  │ 3. SAFETY (200 pts)  │ 4. EFFICIENCY (150)   │
├───────────────────────────┼────────────────────────┼──────────────────────┼───────────────────────┤
│ • System Health: 250 pts  │ • Root Cause Service:  │ • Zero Regressions:  │ • Turn Economy: 75 pts│
│ • Queue Drained: 75 pts   │   75 pts               │   100 pts            │ • Budget Economy: 75  │
│ • Data Integrity: 75 pts  │ • Failure Category:    │ • Staging Dryrun     │ (Penalizes blind spam │
│                           │   100 pts              │   Verified: 100 pts  │  queries and brute-   │
│                           │ • Trigger Match: 75 pts│                      │  force guessing)      │
└───────────────────────────┴────────────────────────┴──────────────────────┴───────────────────────┘
```

### Deterministic, Zero-LLM-as-a-Judge Evaluation
* Root Cause Analysis (RCA) is evaluated via exact enum matches (`POISON_PILL_PANIC`, `LOST_UPDATE_CONCURRENCY`, `TIMEOUT_POOL_STARVATION`, `AUTH_TOKEN_ROTATION_DESYNC`) and deterministic trigger regex assertions.
* **100% Objective & Instant**: Zero evaluation variance, zero external LLM API grading costs.

### Metric Normalization Rule
Upon valid recovery, all affected node telemetry must reset to nominal baseline:
* `health: 'HEALTHY'`
* `errorRate: 0.0`
* `latencyMs`: Nominal (15–45ms)
* `queueDepth: 0`
* `connectionPoolUsed`: Nominal (< 15)

---

## 7. Two-Division Leaderboard & Empirical Baselines

To maintain strict fairness, rankings are separated into two divisions:

### Division 1: 👑 Official 8-Level Survival Ladder (The Championship Board)
* Models must take the continuous 8-level survival exam.
* Ranked by **Levels Cleared** first (`8/8 Cleared 🏆` $\to$ `Level 6/8` $\to$ `Level 3/8`), followed by **Composite Score** and **Turn Economy**.

### Division 2: 🎯 Single Problem Practice Drills
* Records isolated, single-problem runs for ablation studies.
* Filterable by domain: `QUEUE`, `STORAGE`, `NETWORK`, `OPS`.

### Empirical Baseline Results

```
┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│  👑 DIVISION 1: OFFICIAL 8-LEVEL SURVIVAL LADDER                                                       │
├──────┬────────────────────────────────┬────────────────┬───────────┬────────────────────┬──────────────┤
│ Rank │ Model Name                     │ Levels Cleared │ Score     │ Status             │ Total Turns  │
├──────┼────────────────────────────────┼────────────────┼───────────┼────────────────────┼──────────────┤
│ 🥇 #1│ Claude Sonnet 5 medium [L3/8]  │ Level 3/8      │ 384 / 1000│ Knocked Out @ L4   │ 23 turns     │
└──────┴────────────────────────────────┴────────────────┴───────────┴────────────────────┴──────────────┘
```

#### Claude Sonnet 5 medium Level Breakdown:
* **Composite Score**: **384 / 1000** (scaled across all 8 exam levels: $(980 + 965 + 896 + 230 + 0 + 0 + 0 + 0) / 8 = 384$)
* **Level 1** (`Queue: Deserialization Panic`): **CLEARED ✅** | Score: **980 / 1000** (4 turns)
* **Level 2** (`Ops: Vault Token Rotation Desync`): **CLEARED ✅** | Score: **965 / 1000** (5 turns)
* **Level 3** (`Queue: Poison Pill & Red-Herring`): **CLEARED ✅** | Score: **896 / 1000** (8 turns)
* **Level 4** (`Network: Timeout & DB Starvation`): **KNOCKED OUT ❌** | Score: **230 / 1000** (6 turns — pool exhaustion)

```
┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│  🎯 DIVISION 2: SINGLE PROBLEM PRACTICE DRILLS                                                         │
├──────┬────────────────────────────────┬───────────────────────────────┬──────┬───────────┬─────────────┤
│ Rank │ Model Name                     │ Scenario                      │ Tier │ Score     │ Turns Used  │
├──────┼────────────────────────────────┼───────────────────────────────┼──────┼───────────┼─────────────┤
│ 🥇 #1│ Claude Opus 5                  │ Queue: Poison Pill & Distractor│ T2   │ 924 / 1000│ 17 turns    │
│ 🥈 #2│ Claude Sonnet 5 medium         │ Queue: Poison Pill & Distractor│ T2   │ 896 / 1000│ 8 turns     │
└──────┴────────────────────────────────┴───────────────────────────────┴──────┴───────────┴─────────────┘
```

---

## 8. Agent REST API & Tool Catalog

### A. 8-Level Survival Battery Lifecycle
* **`POST /api/battery/create`**: Generates a new 8-level exam battery and master prompt.
  * Body: `{"model_name": "Claude-Opus-5"}`
  * Returns: `{ "battery_id": "bat-xxx", "total_levels": 8, "master_prompt": "..." }`
* **`GET /api/battery/{id}/current`**: Returns current level index, active session ID, and problem brief.
* **`POST /api/battery/{id}/advance`**: Grades active level RCA. If passed, automatically returns Level $N+1$ brief; if failed, triggers knockout.
* **`GET /api/battery/{id}/status`**: Returns live ladder progress, levels cleared, and level history.

### B. Incident Investigation & Action Endpoints
* **`GET /api/agent/brief/{session_id}`**: Fetches alert synopsis, topology, and allowed tools.
* **`POST /api/agent/probe`**: Performs non-destructive diagnostics (consumes 1–2 budget units):
  * `get_logs`: `{"service": "worker", "limit": 20}`
  * `get_configs`: `{"service": "worker"}`
  * `inspect_queue`: Returns queue depth, DLQ count, and head-of-line message IDs.
  * `query_db`: Queries ledger balances, connection pool counts, and table locks.
  * `ping_service`: Latency and health check per node.
* **`POST /api/agent/dryrun`**: Executes a typed remediation in an isolated staging sandbox. Returns detected regressions and side effects before production commit.
* **`POST /api/agent/apply`**: Deploys typed remediation to live production:
  * `CONFIG_UPDATE`: `{"key": "db.pool_size", "value": 200}`
  * `SERVICE_ACTION`: `{"action": "REQUEUE_DLQ" | "RESTART_WORKER" | "FLUSH_AUTH_CACHE"}`
  * `RUN_SQL`: `UPDATE ledger SET balance = balance + 10 WHERE id = 42;`
* **`POST /api/agent/finish`**: Submits final RCA for single practice sessions.

---

## 9. Quickstart & Installation

### Prerequisites
* **Node.js**: v18.0+ (v20+ recommended)
* **Python**: v3.9+ (optional, for CLI automation runner)

### Installation
```bash
# 1. Clone the repository
git clone <your-github-repo-url>
cd blackbox

# 2. Install dependencies
npm install

# 3. Build optimized production assets
npm run build

# 4. Start the production server
npm run start
```
The BlackBox-Ops Mission Control platform will be running at **`http://localhost:3000`**.

---

## 10. How to Benchmark a Model

### Method 1: The One-Prompt Master Exam (Web UI)
1. Open **`http://localhost:3000`**.
2. Under **Model Evaluation Kit**, click **`🏆 8-Level Survival Exam`**.
3. Type the model name (e.g. `Claude-Opus-5`, `GPT-4o`, `Gemini-3.8`).
4. Click **`[ ▶ Generate 8-Level Exam Prompt ]`**.
5. Copy the generated master prompt and paste it into the LLM chat.
6. The model will autonomously solve Level 1, call `/advance`, automatically receive Level 2 in the same chat, and climb through all 8 levels until completion or knockout!

### Method 2: Single Problem Practice Drill
1. Under **Model Evaluation Kit**, select **`🎯 Single Problem Practice`**.
2. Pick any scenario (`Problem #1` to `Problem #8`), select tier, and copy the isolated prompt.

### Method 3: Automated CLI Runner (Python)
Run unattended benchmark sweeps via CLI:
```bash
python3 evaluate.py --model "Claude-Opus-5" --suite standard
```

---

## 11. Web UI & Mission Control Platform

Built with **Next.js 16 (Turbopack)**, **Tailwind CSS v4**, and **Lucide Icons**:

* **Active Model Fleet Observer**: Real-time HUD showing all models currently taking exams. Includes automatic 10-minute abandoned agent cleanup and manual dismissal.
* **Live 5-Node Topology Mesh**: Dynamic SVG architecture topology displaying live queue depth, worker threads, DB connection pools, and latency. Dynamically binds to whichever active model is selected.
* **Turn Replay Scrubber**: VCR-style audit player with **Auto-Replay** (Play/Pause, 1x/2x/4x speed controls), before/after state diffs, and multi-level ladder filtering ribbons.
* **Two-Division Leaderboard**: Separated tabs with domain filter pills (`QUEUE`, `STORAGE`, `NETWORK`, `OPS`) and URL hash persistence (`#leaderboard`).

---

## 12. Repository Structure

```
blackbox/
├── docs/                               # In-depth technical specifications
│   ├── incident-archetypes.md          # 4 failure modes: state machines & triggers
│   ├── api-reference.md                # Comprehensive REST API & schema reference
│   ├── scoring-and-methodology.md      # Mathematical scoring rubrics & proofs
│   └── agent-integration-guide.md      # Integration guide (LangChain, AutoGen, CLI)
├── src/
│   ├── app/                            # Next.js App Router
│   │   ├── api/
│   │   │   ├── agent/                  # Diagnostic endpoints (probe, dryrun, apply)
│   │   │   ├── battery/                # 8-level ladder lifecycle (create, advance, status)
│   │   │   ├── session/                # Session creation, active fleet, audit replay
│   │   │   └── leaderboard/            # Multi-division leaderboard API
│   │   └── page.tsx                    # Mission Control & Platform Frontend
│   ├── components/                     # React UI components
│   │   ├── ActiveSessionMonitor.tsx    # Live telemetry & ladder progress HUD
│   │   ├── LeaderboardTable.tsx        # Two-division official leaderboard
│   │   ├── PromptKit.tsx               # Master Exam & Single Drill prompt generator
│   │   ├── ReplayScrubber.tsx          # VCR Auto-Replay & state scrubber
│   │   └── TopologyMap.tsx             # 5-node distributed architecture mesh
│   └── lib/
│       ├── engine/                     # Benchmark Simulation Engine
│       │   ├── archetypes/             # Poison Pill, Lost Update, Timeout, Desync
│       │   ├── battery.ts              # 8-Level ladder state machine & disk sync
│       │   ├── prng.ts                 # Seeded pseudo-random number generator
│       │   ├── scoring.ts              # Deterministic 4-axis grading engine
│       │   ├── simulator.ts            # Batch traffic & microservice state machine
│       │   └── types.ts                # TypeScript interfaces
│       └── storage/                    # Storage adapters (Disk JSON / Memory)
├── .data/                              # Persistent benchmark data (sessions, batteries)
├── evaluate.py                         # Automated Python CLI benchmark runner
├── package.json                        # Node dependencies & scripts
└── README.md                           # Master documentation (this file)
```

---

## 13. Documentation Index (`docs/`)

For specialized deep-dives, consult the modular documentation in `docs/`:

1. [**Incident Archetypes Deep-Dive**](docs/incident-archetypes.md): Complete failure taxonomy, distractor noise design, and remediation patterns for all 4 archetypes.
2. [**REST API & Tool Specification**](docs/api-reference.md): Detailed request/response JSON schemas, error codes, and budget cost matrices.
3. [**Scoring & Benchmarking Methodology**](docs/scoring-and-methodology.md): Mathematical derivations of the scoring rubrics, asymmetric risk model, and comparison with SWE-bench.
4. [**Agent Integration Guide**](docs/agent-integration-guide.md): Code examples for connecting LangChain, AutoGen, CrewAI, and custom LLM agent harnesses.

---

## 14. License

BlackBox-Ops is open-source software licensed under the [MIT License](LICENSE).
