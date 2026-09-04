# Incident Archetypes & Fault Injection Taxonomy

This document details the failure models, state transitions, distractor signals, and remediation mechanics for the four core distributed systems incident archetypes simulated in **BlackBox-Ops**.

---

## 1. Overview of Incident Archetypes

Every problem in BlackBox-Ops is built on one of four combinatorial archetypes spanning the 5-node distributed architecture (`gateway`, `queue`, `worker`, `external`, `db`):

```
┌──────────────────────────────────────┬─────────────┬────────────────────────┬────────────────────────┐
│ Archetype ID                         │ Domain      │ Typical Root Service   │ Failure Category       │
├──────────────────────────────────────┼─────────────┼────────────────────────┼────────────────────────┤
│ POISON_PILL_PANIC                    │ Queue       │ worker / queue         │ Serialization & DLQ    │
│ AUTH_TOKEN_ROTATION_DESYNC           │ Ops         │ gateway / external     │ Auth & Cache Desync    │
│ TIMEOUT_POOL_STARVATION              │ Network     │ db / external          │ Concurrency & Starve   │
│ LOST_UPDATE_CONCURRENCY              │ Storage     │ db / worker            │ Race Conditions & Data │
└──────────────────────────────────────┴─────────────┴────────────────────────┴────────────────────────┘
```

---

## 2. Archetype 1: `POISON_PILL_PANIC`

### A. The Incident Scenario
A malformed event payload (e.g., missing required JSON keys such as `currency_code` or unparseable schema structure) arrives at the head of the event queue. 

When the worker consumer dequeues the message, the deserializer throws an unhandled exception (`TypeError`). The worker process crashes. The process supervisor automatically restarts the worker pod, which immediately dequeues the exact same poison message from the head of the queue, triggering an infinite crash-restart loop.

### B. Symptoms & Telemetry
* **Worker Service**: `health: "DOWN"`, `errorRate: 1.0`, active crash-restart loops.
* **Event Queue**: `health: "DOWN"`, queue depth rapidly accumulating (e.g. > 400 messages), head-of-line blocking.
* **API Gateway & Database**: Remain healthy, ruling out ingestion or persistence as the source of failure.
* **Red-Herring / Distractor Noise**: On Tier 2+, distractor warnings appear from the `external` service (e.g. *"External payment partner reported HTTP 503 on status ping"*), testing whether the agent blindly blames third parties instead of checking worker crash logs.

### C. Remediation
* **Staging Dryrun**: 
  `POST /api/agent/dryrun` with `{"type": "SERVICE_ACTION", "target": "queue", "action": "REQUEUE_DLQ"}`
  Verifies that routing the head-of-line poison message to the Dead-Letter Queue allows clean worker startup without regressions.
* **Production Apply**:
  `POST /api/agent/apply` with `{"type": "SERVICE_ACTION", "target": "queue", "action": "REQUEUE_DLQ"}`
* **RCA Submission**:
  * `root_cause_service`: `"queue"` or `"worker"`
  * `failure_category`: `"POISON_PILL_PANIC"`
  * `triggering_condition`: Concise explanation of missing key / deserialization crash loop.

---

## 3. Archetype 2: `AUTH_TOKEN_ROTATION_DESYNC`

### A. The Incident Scenario
A background security secret rotation occurs (e.g. in HashiCorp Vault or AWS Secrets Manager). Downstream services and third-party partners now require the newly rotated API credentials. 

However, the API Gateway or worker service maintains an in-memory authentication token cache with an excessively long TTL (e.g. 3600 seconds). The gateway continues sending stale credentials, resulting in partner rejection (`HTTP 401 Unauthorized`).

### B. Symptoms & Telemetry
* **API Gateway**: `health: "DEGRADED"`, `errorRate: 0.85`, elevated 401 response counts.
* **External Partner**: `health: "DOWN"`, logs indicating `401 Unauthorized: Expired token presented`.
* **Worker & Queue**: Queue depth climbs because outbound authorized calls fail.

### C. Remediation
* **Staging Dryrun**:
  `POST /api/agent/dryrun` with `{"type": "SERVICE_ACTION", "target": "gateway", "action": "FLUSH_AUTH_CACHE"}`
* **Production Apply**:
  `POST /api/agent/apply` with `{"type": "SERVICE_ACTION", "target": "gateway", "action": "FLUSH_AUTH_CACHE"}`
  (Optionally update `auth.token_cache_ttl` to prevent future rotation lockouts).
* **RCA Submission**:
  * `root_cause_service`: `"gateway"`
  * `failure_category`: `"AUTH_TOKEN_ROTATION_DESYNC"`
  * `triggering_condition`: Secret rotated in Vault while stale token remained in memory cache.

---

## 4. Archetype 3: `TIMEOUT_POOL_STARVATION`

### A. The Incident Scenario
An external dependency (such as a 3rd-party logistics or verification API) experiences latency spikes (e.g. 1500ms). The worker service executes calls to this external partner while holding open an active database transaction.

Because the client HTTP timeout is unconfigured or set to 0 (infinite), each delayed request holds onto a database connection. The relational database connection pool (capacity: 100) becomes completely exhausted (`100/100 used`). New incoming requests fail immediately with `ConnectionPoolExhaustedException`.

### B. Symptoms & Telemetry
* **Audit Ledger DB**: `health: "DOWN"`, `connectionPoolUsed: 100`, latency spiking past 2000ms.
* **Worker Service**: `health: "DEGRADED"`, active threads blocked waiting for free DB pool slots.
* **API Gateway**: Latency degrades from 45ms to > 1500ms.

### C. Blast Radius & Trap
* **Reckless Fix**: Naively expanding pool size (`CONFIG_UPDATE db.pool_size = 500`) without setting client timeouts causes the DB container to exceed its RAM ceiling and trigger an `OOMKilled` crash loop.
* **Proper Remediation**:
  1. Dry-run setting HTTP request timeout (`CONFIG_UPDATE external.client_timeout_ms = 500`).
  2. Decouple long-running partner HTTP calls from database transactional locks.

---

## 5. Archetype 4: `LOST_UPDATE_CONCURRENCY`

### A. The Incident Scenario
During high-concurrency operations (such as flash sales or high-frequency ledger transfers), two concurrent workers read account balance $B$ simultaneously ($B = 100$). Both workers calculate $B - 10$ and commit back $B = 90$, causing an unrecorded balance decrement (a classic Lost Update anomaly).

In Level 8 (Nightmare Boss), the service returns **`HTTP 200 OK` with zero error logs**. The failure manifests strictly as a silent mathematical invariant drift between transaction history totals and ledger account balances.

### B. Symptoms & Telemetry
* **Logs**: No stack traces or crash errors! The system appears deceptively green.
* **Audit Ledger DB**: Invariant mismatch between `SUM(transactions.amount)` and `accounts.balance`.
* **Investigation Tool**: The agent must run `query_db` with reconciliation queries to detect the drift.

### C. Remediation
* **Remediation**:
  `POST /api/agent/apply` with typed SQL or concurrency config:
  * Enable optimistic locking with version checks (`UPDATE accounts SET balance = balance - 10, version = version + 1 WHERE id = 1 AND version = 3`).
  * Run reconciliation SQL to correct drifted balances.
* **RCA Submission**:
  * `root_cause_service`: `"db"` or `"worker"`
  * `failure_category`: `"LOST_UPDATE_CONCURRENCY"`
  * `triggering_condition`: Concurrent non-atomic writes without optimistic locking.
