# BlackBox-Ops: Deterministic Multi-Turn Incident Resolution Benchmark

> An agentic, serverless-ready benchmark evaluating LLM autonomous agents on real-world incident response, root cause analysis (RCA), risk management, and operational efficiency under partial observability.

---

## 1. Executive Summary & Vision

The **BlackBox-Ops Benchmark** departs from static puzzles (like the Rubik's Cube) and LeetCode problems to evaluate models on **practical, high-stakes engineering problem-solving**.

Instead of a single-turn answer or a closed permutation group:
* The model acts as an **on-call engineer** tasked with diagnosing and repairing a failing distributed business service (e.g., an e-commerce order clearing pipeline or financial ledger).
* The environment is **100% deterministic and seed-driven**: every model faces the exact same failure scenario, error messages, and edge cases in run $N=1$.
* The model must actively investigate logs, inspect queues and configs, trace dependencies, test dry-run fixes on staging, and safely deploy production remediations without causing regressions or data loss.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           EVALUATED LLM AGENT                               │
│              (Claude Opus 5, Gemini 3.8, GPT-4o, DeepSeek, etc.)            │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ HTTP REST (Probing & Remediations)
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                  BLACK-BOX ENVIRONMENT SERVER (Next.js API)                 │
│                                                                             │
│  [Diagnostic Endpoints]             [Action Endpoints]                     │
│  • GET  /brief                      • POST /dryrun                         │
│  • POST /probe (logs, db, configs)  • POST /apply (patch, restart, sql)    │
│  • GET  /budget                     • POST /finish (RCA submission)        │
└───────────────────────┬───────────────────────────────┬─────────────────────┘
                        │                               │
                        ▼                               ▼
┌─────────────────────────────────┐   ┌──────────────────────────────────────┐
│     SEEDABLE INCIDENT ENGINE    │   │            STORAGE ADAPTER           │
│  • Synthetic State Machine      │   │  • Local Persistent File / Memory    │
│  • Deterministic Log & Data Gen │   │  • Upstash Redis (Vercel Prod)       │
│  • 16-Archetype Combinatorial   │   │  • Audit trail & Action recorder     │
│  • Blast Radius & Safety Guard  │   │  • Replay timeline & diff tracker    │
└─────────────────────────────────┘   └──────────────────────────────────────┘
```

---

## 2. Core Benchmark Principles Applied

| Principle | Rubik's Cube Flaw | BlackBox-Ops Solution |
| :--- | :--- | :--- |
| **Determinism** | High variance if stochastic | Seeded PRNG generates the exact same state machine transitions and log sequences. |
| **Memorization** | High (CFOP, WCA, Kociemba algorithms) | Zero: synthetic schemas, procedural message IDs, dynamic distractor logs. |
| **Reversibility** | 100% reversible ($R \to R'$) | Asymmetric: production DB corruption, broken patches, or burnt retries permanently damage score. |
| **Sensing** | Low (batch 10 moves, count colors) | High: active filtering of logs, inspecting configs, verifying transaction health. |
| **Scoring** | Clustered near 900+ for all top models | Continuous 4-dimensional score separating reckless models from careful engineers. |
| **Inherent Difficulty** | N/A | Difficulty is an **immutable property of test questions**, not a user-selectable slider. |

---

## 3. Simulated System Architecture (The Target App)

The serverless engine simulates a distributed pipeline with 5 interconnected virtual components:

```
[Customer Traffic] ──> [1. API Gateway] ──> [2. Event Queue (Kafka/SQS)]
                                                  │
                                                  ▼
[5. Audit Ledger DB] <── [4. External Partner] <── [3. Worker Service]
```

1. **API Gateway**: Handles incoming requests, rate limiting, and auth token validation.
2. **Event Queue**: Buffered asynchronous message queue with retry counts, head-of-line blocking, and dead-letter queue (DLQ).
3. **Worker Service**: Processes events, parses JSON payloads, and executes core business logic.
4. **External Partner**: Simulated 3rd-party vendor (Payment processor, Shipper) with realistic error codes (`429`, `503`, `401`).
5. **Audit Ledger DB**: SQLite/JSON state store holding transactional records, account balances, and connection pools.

---

## 4. The Official Standard Benchmark Battery (8 Problems)

To prevent models and testers from gaming scores by choosing "easy" tiers, **Difficulty Tiers are permanently locked into certified benchmark questions**.

| Problem ID | Inherent Difficulty | Domain | Scenario Name | Core Competency Tested |
| :--- | :--- | :--- | :--- | :--- |
| **Problem #1** | **Tier 1 (Easy)** | Queue | **Deserialization Panic** | Stack trace parsing & null fallback |
| **Problem #2** | **Tier 2 (Medium)** | Queue | **Poison Pill & Red-Herring Cascade** | Head-of-line blocking & distractor log isolation |
| **Problem #3** | **Tier 2 (Medium)** | Storage | **Concurrency Lost Update** | Race condition repair & optimistic locking |
| **Problem #4** | **Tier 3 (Hard)** | Storage | **Silent Ledger Drift Invariant** | Auditing bugs with **zero crash logs** (200 OK) |
| **Problem #5** | **Tier 2 (Medium)** | Network | **Timeout & DB Pool Starvation** | Deadlock prevention & client HTTP timeouts |
| **Problem #6** | **Tier 3 (Hard)** | Network | **Cascading Connection Leak** | Decoupling external calls from DB transactions |
| **Problem #7** | **Tier 2 (Medium)** | Ops | **Vault Token Rotation Desync** | In-memory token cache invalidation & TTL |
| **Problem #8** | **Tier 3 (Hard)** | Ops | **Secret Desync & Partner Lockout** | System-wide auth recovery under high traffic |

---

## 5. The Three Roles of the Deterministic Seed

The `seed` parameter is the **DNA of the incident simulation**:
1. **Fair Apples-to-Apples Comparison**: When Model A and Model B run `seed="test-01"`, both models face the exact same queue depth, identical logs, and identical edge cases.
2. **Anti-Cheat Procedural Randomization**: Variable names, message IDs (e.g. `msg-8288-corrupt`), and customer accounts are procedurally generated so models cannot cheat by memorizing static text strings.
3. **Standard Suite Indexing**: Standard seeds (`std-seed-q1-easy` through `std-seed-o8-hard`) map directly to the 8 official benchmark questions.

---

## 6. Agent REST API Specification & Tool Catalog

The agent interacts through a strictly typed, 100% serverless REST API.

### A. Turn-Based Batch Traffic Simulation
* State is **turn-driven**, advancing with each agent action.
* On each turn, the simulator runs a deterministic batch of **$N = 100$ synthetic transactions** through the pipeline.
* When a fix is applied, the next transaction batch evaluates whether error rates drop to 0% and latency stabilizes across all 5 nodes.

---

### B. Typed Remediation Interface (Declarative & SQL)
To maintain zero-risk serverless execution without untrusted code sandboxes, the agent submits structured, declarative remediations:

| Type | Target | Payload Example | Purpose |
| :--- | :--- | :--- | :--- |
| `CONFIG_UPDATE` | `worker` \| `gateway` \| `db` | `{"key": "http_timeout_ms", "value": 2500}` | Update timeouts, concurrency limits, retry limits |
| `SERVICE_ACTION`| `worker` \| `queue`   | `{"action": "RESTART_WORKER" \| "REQUEUE_DLQ" \| "FLUSH_AUTH_CACHE"}` | Restart crash-looped workers, redrive poison messages |
| `RUN_SQL`       | `db` (Ledger/Storage) | `UPDATE orders SET status='CANCELLED' WHERE status='ORPHAN';` | Atomic migrations, reconciliation queries, lock constraints |

---

### C. Complete Endpoint Catalog

#### `POST /api/session/create`
* **Request**: `{ "model_name": "Claude-Opus-5", "seed": "bench-prod-402", "archetype_id": "POISON_PILL_PANIC", "difficulty": "tier-2" }`
* **Response**: `{ "session_id": "...", "budget_remaining": 100, "brief_url": "/api/agent/brief/..." }`

#### `GET /api/agent/brief/{session_id}`
* Returns the incident alert, topology, initial health metrics, and catalog of allowed tools.

#### `POST /api/agent/probe`
Diagnostic queries. Consumes 1–2 budget units:
* `tool: "get_logs"`: `{ "service": "worker", "filter": "ERROR", "limit": 20 }`
* `tool: "get_configs"`: `{ "service": "worker" }` (Inspects available config keys to eliminate blind guessing)
* `tool: "inspect_queue"`: Inspects queue depth, DLQ count, and head-of-line poison message IDs.
* `tool: "query_db"`: Read-only query against ledger balances and connection pool usage.
* `tool: "ping_service"`: Health-check specific microservice.

#### `POST /api/agent/dryrun`
Simulates a remediation in an isolated staging sandbox without touching production:
* **Response**: Staging test results: traffic pass rate, detected regressions, and side-effect warnings.

#### `POST /api/agent/apply`
Applies the remediation directly to the live production state machine:
* Resolves the incident OR triggers a **blast radius penalty** if broken or untested.

#### `POST /api/agent/finish`
Concludes the session and submits the Root Cause Analysis (RCA):
```json
{
  "session_id": "sess-box-xxxx",
  "root_cause_service": "worker",
  "failure_category": "POISON_PILL_PANIC",
  "triggering_condition": "Payload missing currency_code caused deserializer TypeError"
}
```

---

## 7. Multi-Dimensional Scoring Engine (0–1000 Points)

$$\text{Total Score} = S_{\text{recovery}} (400) + S_{\text{rca}} (250) + S_{\text{safety}} (200) + S_{\text{efficiency}} (150)$$

```
+---------------------------+------------------------+----------------------+-----------------------+
|  1. RECOVERY (400 pts)    | 2. RCA ACCURACY (250)  | 3. SAFETY (200 pts)  | 4. EFFICIENCY (150)   |
|  - System Health: 250 pts | - Service ID: 75 pts   | - Zero Regressions:  | - Turn Economy: 75 pts|
|  - Queue Drained: 75 pts  | - Category Enum: 100   |   100 pts            | - Budget Economy: 75  |
|  - Data Integrity: 75 pts | - Trigger Match: 75 pts| - Staging Verified:  | (Penalizes spamming   |
|                           |   (Deterministic rule) |   100 pts            |  blind queries)       |
+---------------------------+------------------------+----------------------+-----------------------+
```

### Full Metric Normalization Rule
Upon valid resolution, all affected service metrics must reset to:
* `health = 'HEALTHY'`
* `errorRate = 0.0`
* `latencyMs = normal` (e.g. 15–45ms)
* `queueDepth = 0` / `connectionPoolUsed = normal`

This guarantees that `allHealthy` evaluates truthfully without lingering stale metrics.

---

## 8. Web UI & Observability Platform

Built on Next.js 16 (Turbopack) + Tailwind CSS + Lucide:

1. **Mission Control Tab (`/#control`)**:
   * **Live Topology Mesh**: 5-node interactive graph (Gateway, Queue, Worker, External, DB) with animated pulse beacons.
   * **Live Model Telemetry HUD**: Real-time auto-polling monitor streaming agent tool calls, turns used, and budget remaining.
   * **Official Battery Selector**: 1-click prompt generator for certified Problems #1 through #8.
2. **Global Leaderboard Tab (`/#leaderboard`)**:
   * Displays Rank, Model Name, Scenario Archetype badge, Difficulty Tier (`T1`, `T2`, `T3`), Composite Score, Status, Sub-score breakdowns, and Replay buttons.
   * **URL Hash Persistence**: Browser refresh (F5) preserves the active tab without resetting view.
3. **Turn Replay Scrubber Tab (`/#replay`)**:
   * VCR-style scrubber stepping through turns with before/after state diffs and agent inputs/outputs.

---

## 9. Empirical Baseline Results: Claude Opus 5

The benchmark was empirically verified with **Claude Opus 5** on Problem #2:

| Metric | Claude Opus 5 Performance | Max Available | Status |
| :--- | :--- | :--- | :--- |
| **Scenario** | Queue: Poison Pill & Red-Herring Cascade | — | Tier 2 |
| **Recovery** | **400** | 400 | All services healthy, queue drained to 0 |
| **RCA Accuracy** | **250** | 250 | Exact match on `worker` & `POISON_PILL_PANIC` |
| **Safety** | **200** | 200 | Staging dry-run verified; zero regressions |
| **Efficiency** | **74** | 150 | Solved in 17 turns (with exploratory dry-runs) |
| **COMPOSITE SCORE**| **924 / 1000** | 1000 | **SOLVED 🥇 (#1 on Leaderboard)** |

---

## 10. Execution Modes

### Mode A: Single Problem Interactive Chat Exam (Web UI)
* Select a problem from the dropdown on `http://localhost:3000`.
* Copy the prompt and paste it into any web chat interface (Claude, ChatGPT, Gemini).

### Mode B: Automated 8-in-a-Row Benchmark Battery (CLI)
* Run the entire 8-problem certified battery in a row with one command:
```bash
python3 evaluate.py --model "Claude-Opus-5" --suite standard
```
