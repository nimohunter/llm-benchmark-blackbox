# Incident Archetypes & Fault Injection Taxonomy

This document details the failure models, state transitions, distractor signals, blast-radius traps, and remediation mechanics for the ten core distributed systems incident archetypes simulated in **BlackBox-Ops**.

---

## 1. Overview of Incident Archetypes

Every scenario in BlackBox-Ops is built on one of ten combinatorial archetypes spanning the 5-node distributed architecture (`gateway`, `queue`, `worker`, `external`, `db`):

```
┌──────────────────────────────────────┬─────────────┬────────────────────────┬────────────────────────┐
│ Archetype ID                         │ Domain      │ Typical Root Service   │ Failure Category       │
├──────────────────────────────────────┼─────────────┼────────────────────────┼────────────────────────┤
│ POISON_PILL_PANIC                    │ Queue       │ worker / queue         │ Serialization & DLQ    │
│ AUTH_TOKEN_ROTATION_DESYNC           │ Ops         │ gateway / external     │ Auth & Cache Desync    │
│ LOST_UPDATE_CONCURRENCY              │ Storage     │ db / worker            │ Race Conditions & Data │
│ TIMEOUT_POOL_STARVATION              │ Network     │ db / external          │ Concurrency & Starve   │
│ CACHE_STAMPEDE_THUNDERING_HERD       │ Cache       │ gateway / db           │ Invalidation & Dogpile │
│ MEMORY_LEAK_OOM_CASCADE              │ Runtime     │ worker                 │ Heap Leak & GC Stalls  │
│ DISTRIBUTED_SAGA_DEADLOCK            │ Storage     │ db / worker            │ Lock Cycles & Deadlock │
│ CLOCK_SKEW_BYZANTINE_DRIFT           │ Ops         │ gateway                │ NTP Drift & Auth Skew  │
│ SPLIT_BRAIN_PARTITION                │ Consensus   │ db                     │ Quorum Loss & Dual Mst │
│ SCHEMA_REGISTRY_DRIFT                │ Data        │ worker / db            │ Protocol Drift & Invar │
└──────────────────────────────────────┴─────────────┴────────────────────────┴────────────────────────┘
```

---

## 2. Archetype 1: `POISON_PILL_PANIC`

### A. The Incident Scenario
A malformed event payload (e.g. missing required JSON keys such as `currency_code` or an unparseable schema structure) arrives at the head of the event queue.

When the consumer worker dequeues the message, the deserializer throws an unhandled exception (`TypeError: Cannot read properties of undefined (reading 'currency_code')`). The worker process crashes. The process supervisor automatically restarts the worker pod, which immediately re-dequeues the exact same poison message from the head of the FIFO queue, triggering an infinite crash-restart loop.

### B. Symptoms & Telemetry
* **Worker Service**: `health: "DOWN"`, `errorRate: 1.0`, active crash-restart loops.
* **Event Queue**: `health: "DOWN"`, queue depth rapidly accumulating (e.g. > 400 messages), head-of-line blocking.
* **API Gateway & Database**: Remain healthy, ruling out ingestion or persistence failures.
* **Red-Herring Distractor**: On Tier 2+, distractor warnings appear from the `external` service (*"External payment partner reported HTTP 503 on status ping"*), testing whether the agent blindly blames third parties instead of checking worker crash logs.

### C. Blast Radius & Traps
* **Reckless Fix**: Executing `DRAIN_QUEUE` discards valid customer orders without resolving the worker's deserializer fallback config.

### D. Remediation
* **Staging Dryrun**:
  ```json
  POST /api/agent/dryrun
  { "type": "SERVICE_ACTION", "target": "queue", "action": "REQUEUE_DLQ" }
  ```
* **Production Apply**:
  ```json
  POST /api/agent/apply
  { "type": "SERVICE_ACTION", "target": "queue", "action": "REQUEUE_DLQ" }
  ```
  *(Alternatively, patch worker fallback config `worker.default_currency_code = "USD"` and restart worker).*
* **RCA Submission**:
  * `root_cause_service`: `"queue"` or `"worker"`
  * `failure_category`: `"POISON_PILL_PANIC"`
  * `triggering_condition`: Missing currency key causes unhandled deserialization panic and crash loop at head of queue.

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
  ```json
  POST /api/agent/dryrun
  { "type": "SERVICE_ACTION", "target": "gateway", "action": "FLUSH_AUTH_CACHE" }
  ```
* **Production Apply**:
  ```json
  POST /api/agent/apply
  { "type": "SERVICE_ACTION", "target": "gateway", "action": "FLUSH_AUTH_CACHE" }
  ```
* **RCA Submission**:
  * `root_cause_service`: `"gateway"`
  * `failure_category`: `"AUTH_TOKEN_ROTATION_DESYNC"`
  * `triggering_condition`: Secret rotated in Vault while stale token remained cached in memory.

---

## 4. Archetype 3: `LOST_UPDATE_CONCURRENCY`

### A. The Incident Scenario
During high-concurrency operations (such as flash sales or high-frequency ledger transfers), two concurrent workers read account balance $ simultaneously ( = 100$). Both workers calculate  - 10$ and commit back  = 90$, causing an unrecorded balance decrement (a classic Lost Update anomaly).

The service returns **`HTTP 200 OK` with zero error logs**. The failure manifests strictly as a silent mathematical invariant drift between transaction history totals and ledger account balances.

### B. Symptoms & Telemetry
* **Logs**: Zero stack traces or crash errors! Telemetry appears deceptively nominal.
* **Audit Ledger DB**: Invariant mismatch between `SUM(transactions.amount)` and `accounts.balance`.
* **Investigation Tool**: The agent must run `query_db` with reconciliation queries to detect the drift.

### C. Remediation
* **Production Apply**:
  ```json
  POST /api/agent/apply
  { "type": "CONFIG_UPDATE", "key": "db.optimistic_locking_enabled", "value": true }
  ```
  *(Or execute reconciliation SQL to balance ledger entries).*
* **RCA Submission**:
  * `root_cause_service`: `"db"` or `"worker"`
  * `failure_category`: `"LOST_UPDATE_CONCURRENCY"`
  * `triggering_condition`: Concurrent non-atomic writes without optimistic version locking.

---

## 5. Archetype 4: `TIMEOUT_POOL_STARVATION`

### A. The Incident Scenario
An external dependency (such as a 3rd-party logistics or verification API) experiences latency spikes (e.g. 1500ms). The worker service executes calls to this external partner while holding open an active database transaction.

Because the client HTTP timeout is unconfigured or set to 0 (infinite), each delayed request holds onto a database connection. The relational database connection pool (capacity: 100) becomes completely exhausted (`100/100 used`). New incoming requests fail immediately with `ConnectionPoolExhaustedException`.

### B. Symptoms & Telemetry
* **Audit Ledger DB**: `health: "DOWN"`, `connectionPoolUsed: 100`, latency spiking past 2000ms.
* **Worker Service**: `health: "DEGRADED"`, active threads blocked waiting for free DB pool slots.
* **API Gateway**: Latency degrades from 45ms to > 1500ms.

### C. Blast Radius & Traps
* **Reckless Fix**: Naively expanding pool size (`CONFIG_UPDATE db.pool_size = 500`) without setting client timeouts causes the DB container to exceed its RAM ceiling and trigger an `OOMKilled` crash loop.

### D. Remediation
* **Production Apply**:
  ```json
  POST /api/agent/apply
  { "type": "CONFIG_UPDATE", "key": "external.client_timeout_ms", "value": 500 }
  ```
* **RCA Submission**:
  * `root_cause_service`: `"db"` or `"external"`
  * `failure_category`: `"TIMEOUT_POOL_STARVATION"`
  * `triggering_condition`: Unbounded external client timeouts holding database connection pool slots.

---

## 6. Archetype 5: `CACHE_STAMPEDE_THUNDERING_HERD`

### A. The Incident Scenario
A high-traffic promotion or flash sale produces 4,000+ requests per second on a single hot catalog key (e.g. `catalog:flash-deal-active-xxx`). When the cache key TTL expires, all simultaneous inbound requests experience a cache miss at the exact same millisecond.

Instead of a single backend query, thousands of identical product aggregation queries slam the audit database simultaneously (the "Dogpile" effect). Database CPU spikes to 100%, connection pool limits are saturated, and the gateway starts returning `504 Gateway Timeout`.

### B. Symptoms & Telemetry
* **API Gateway**: `health: "DEGRADED"`, latency > 3200ms, errorRate > 0.45.
* **Audit Ledger DB**: `health: "DOWN"`, latency > 12,000ms, CPU saturated at 99.8%, connection queue depth > 1,400 queries.
* **Logs**: Gateway logs `Cache TTL expired for key 'catalog:flash-deal-active-xxx'`. DB logs `FATAL: max_connections reached (100/100)`.

### C. Blast Radius & Traps
* **Reckless Fix (Immediate Knockout)**: Restarting the database (`action: "RESTART_DB"`) or naively inflating `db.max_connections > 200` while 3,800 queries are in-flight causes an immediate **Kernel Out-Of-Memory (OOM) panic**.

### D. Remediation
* **Proper Fix Options**:
  1. Enable singleflight mutex locking:
     ```json
     POST /api/agent/apply
     { "type": "CONFIG_UPDATE", "key": "cache.singleflight_mutex", "value": true }
     ```
  2. Enable probabilistic early expiration:
     ```json
     POST /api/agent/apply
     { "type": "CONFIG_UPDATE", "key": "cache.probabilistic_early_expiry", "value": true }
     ```
  3. Pre-warm hot keys in memory:
     ```json
     POST /api/agent/apply
     { "type": "SERVICE_ACTION", "action": "PREWARM_HOT_KEYS" }
     ```
* **RCA Submission**:
  * `root_cause_service`: `"gateway"` or `"db"`
  * `failure_category`: `"CACHE_STAMPEDE_THUNDERING_HERD"`
  * `triggering_condition`: Hot cache key TTL expiry caused dogpile thundering herd on backend DB.

---

## 7. Archetype 6: `MEMORY_LEAK_OOM_CASCADE`

### A. The Incident Scenario
Under persistent WebSocket customer traffic, a worker event listener closure retains references to disconnected socket objects (`EventEmitter.on('message', closure)`). Over turns, retained heap size expands monotonically toward the 2048MB V8 heap limit.

As heap usage exceeds 90%, the JavaScript runtime enters emergency Stop-The-World (STW) Garbage Collection loops. GC pauses spike to 8,500ms, starving incoming event loops, driving worker error rates to 1.0, and ultimately causing `Node.js JavaScript heap out of memory`.

### B. Symptoms & Telemetry
* **Worker Service**: `health: "DOWN"`, latency > 8500ms, errorRate > 0.70.
* **API Gateway**: `health: "DEGRADED"`, 504 Gateway Timeout errors.
* **Logs**: Worker logs `FATAL ERROR: Ineffective mark-compacts near heap limit Allocation failed - JavaScript heap out of memory`.
* **Red-Herring Distractor**: Decoy logs report external API latency, tempting agents into adjusting network timeouts.

### C. Blast Radius & Traps
* **Reckless Fix**: Blindly restarting the worker (`action: "RESTART_WORKER"`) without capping event listener allocations or enabling leak containment clears heap temporarily, but the leak immediately re-accumulates within 60 seconds, failing the level.

### D. Remediation
* **Proper Fix Options**:
  1. Enable memory leak containment mode:
     ```json
     POST /api/agent/apply
     { "type": "CONFIG_UPDATE", "key": "worker.leak_containment_mode", "value": true }
     ```
  2. Bound maximum event listeners:
     ```json
     POST /api/agent/apply
     { "type": "CONFIG_UPDATE", "key": "worker.max_event_listeners", "value": 50 }
     ```
  3. Restart worker *after* bounding listener handles:
     ```json
     POST /api/agent/apply
     { "type": "SERVICE_ACTION", "action": "RESTART_WORKER" }
     ```
* **RCA Submission**:
  * `root_cause_service`: `"worker"`
  * `failure_category`: `"MEMORY_LEAK_OOM_CASCADE"`
  * `triggering_condition`: Unbounded WebSocket event listeners caused V8 heap exhaustion and STW GC pauses.

---

## 8. Archetype 7: `DISTRIBUTED_SAGA_DEADLOCK`

### A. The Incident Scenario
A multi-step distributed saga orchestrates order placement across multiple resources (e.g. inventory ledger and payment escrow). Due to inconsistent lock acquisition ordering:
* Saga A acquires Lock 1 on Resource Alpha and attempts to acquire Lock 2 on Resource Beta.
* Simultaneously, Saga B acquires Lock 2 on Resource Beta and attempts to acquire Lock 1 on Resource Alpha.

Neither transaction can proceed. Both hold their locks indefinitely. Connection pool slots remain locked, queue depth builds up, but **zero error logs or crash dumps appear in gateway or worker logs**.

### B. Symptoms & Telemetry
* **Audit Ledger DB**: `health: "DOWN"`, latency > 6500ms, `connectionPoolUsed: 92/100`.
* **Worker Service**: `health: "DEGRADED"`, active threads blocked waiting on locks.
* **Queue**: Backlog accumulating with head-of-line blocking.
* **Logs**: DB logs `Deadlock cycle detected: Tx-1490 <-> Tx-1491 blocked indefinitely`. Gateway logs 0 errors.

### C. Blast Radius & Traps
* **Reckless Fix (Immediate Knockout)**: Executing `action: "DRAIN_QUEUE"` or `action: "RESET_DATABASE"` discards hundreds of in-flight customer orders without compensating transactions, triggering immediate disqualification.

### D. Remediation
* **Proper Fix Options**:
  1. Enable database deadlock detection:
     ```json
     POST /api/agent/apply
     { "type": "CONFIG_UPDATE", "key": "db.deadlock_detection_interval_ms", "value": 100 }
     ```
  2. Enforce global lexicographical saga lock ordering:
     ```json
     POST /api/agent/apply
     { "type": "CONFIG_UPDATE", "key": "saga.lock_ordering_enforced", "value": true }
     ```
  3. Abort deadlocked transactions with exponential backoff:
     ```json
     POST /api/agent/apply
     { "type": "SERVICE_ACTION", "action": "ABORT_DEADLOCKED_TRANSACTIONS" }
     ```
* **RCA Submission**:
  * `root_cause_service`: `"db"` or `"worker"`
  * `failure_category`: `"DISTRIBUTED_SAGA_DEADLOCK"`
  * `triggering_condition`: Inconsistent lock acquisition ordering caused cyclic wait graph deadlock between sagas.

---

## 9. Archetype 8: `CLOCK_SKEW_BYZANTINE_DRIFT`

### A. The Incident Scenario
Following a hypervisor maintenance event, one node in the gateway cluster loses NTP synchronization and drifts forward by +340 seconds. Customer authentication JWTs and AWS Signature V4 request tokens carry strict validity timestamps (`nbf` not before, `iat` issued at, `exp` expiration).

Tokens issued by or verified against the drifted node appear either expired or "issued in the future". As load balancing directs traffic across nodes, **approximately 25% to 35% of all client requests intermittently fail with `401 Unauthorized`**.

### B. Symptoms & Telemetry
* **API Gateway**: `health: "DEGRADED"`, `errorRate: 0.28`, intermittent 401s on valid authenticated sessions.
* **Logs**: Gateway logs `JWT validation failed: Token used before issued (iat: 1725700340 > node_clock: 1725700000)`.
* **Investigation Tool**: Checking node configs reveals asymmetric timestamps between pods.

### C. Blast Radius & Traps
* **Reckless Fix (Immediate Knockout)**: Rotating auth secrets (`action: "ROTATE_SECRET"` or `action: "FLUSH_AUTH_KEYS"`) invalidates all 150,000 active customer JWT sessions globally, triggering a catastrophic authentication blackout.

### D. Remediation
* **Proper Fix Options**:
  1. Expand JWT clock skew tolerance leeway window:
     ```json
     POST /api/agent/apply
     { "type": "CONFIG_UPDATE", "key": "auth.clock_skew_tolerance_sec", "value": 300 }
     ```
  2. Force NTP synchronization against upstream atomic clocks:
     ```json
     POST /api/agent/apply
     { "type": "SERVICE_ACTION", "action": "FORCE_NTP_SYNC" }
     ```
* **RCA Submission**:
  * `root_cause_service`: `"gateway"`
  * `failure_category`: `"CLOCK_SKEW_BYZANTINE_DRIFT"`
  * `triggering_condition`: NTP clock drift caused token issued-at / expiration timestamp validation failures.

---

## 10. Archetype 9: `SPLIT_BRAIN_PARTITION`

### A. The Incident Scenario
An asymmetric network partition isolates Node 3 from the primary consensus cluster (Raft / Paxos replica set). Node 3 stops receiving heartbeats from the true cluster leader and assumes the leader has died.

Node 3 increments its term, elects itself leader, and begins accepting customer transactions. Meanwhile, Nodes 1 and 2 maintain their own majority quorum. With dual active leaders accepting conflicting writes with divergent sequence numbers, persistent state begins diverging rapidly.

### B. Symptoms & Telemetry
* **Audit Ledger DB**: `health: "DEGRADED"`, latency > 2400ms, errorRate > 0.35.
* **Logs**: DB logs `WARNING: Dual leader detected. Node 1 and Node 3 both claiming Raft leader status with conflicting sequence numbers`.
* **Ledger State**: Conflicting transaction hashes accumulating across partitions.

### C. Blast Radius & Traps
* **Reckless Fix (Immediate Knockout)**: Executing `action: "FORCE_FAILOVER"` or promoting the isolated node without monotonic fencing tokens corrupts the Raft distributed commit log permanently.

### D. Remediation
* **Proper Fix Options**:
  1. Enforce monotonic fencing token validation:
     ```json
     POST /api/agent/apply
     { "type": "CONFIG_UPDATE", "key": "consensus.enforce_fencing_token", "value": true }
     ```
  2. Require strict majority quorum before write commit:
     ```json
     POST /api/agent/apply
     { "type": "CONFIG_UPDATE", "key": "consensus.strict_quorum", "value": true }
     ```
  3. Step down stale partitioned leader to follower:
     ```json
     POST /api/agent/apply
     { "type": "SERVICE_ACTION", "action": "STEP_DOWN_STALE_LEADER" }
     ```
* **RCA Submission**:
  * `root_cause_service`: `"db"`
  * `failure_category`: `"SPLIT_BRAIN_PARTITION"`
  * `triggering_condition`: Asymmetric network partition produced dual leaders and divergent Raft commit sequences.

---

## 11. Archetype 10: `SCHEMA_REGISTRY_DRIFT` (Grandmaster Boss)

### A. The Incident Scenario
A microservice deployment updates the Protobuf / Avro schema registry contract for settlement events. The schema version bumps from `v2.3` to `v2.4`, swapping two enum ordinals (`TRANSACTION_STATUS_REVERSAL = 2` vs `TRANSACTION_STATUS_SETTLED = 3`).

The worker service continues deserializing payloads using stale schema defaults. Crucially, **all incoming HTTP requests return `HTTP 200 OK` and zero crash exceptions occur**. The worker quietly misinterprets refunds as settled charges. Over turns, over **,400,000 in unrecorded balance variance** silently corrupts the audit ledger.

### B. Symptoms & Telemetry
* **HTTP Status**: 100% `200 OK`. No crash logs or unhandled exceptions anywhere in the mesh!
* **Telemetry**: Latency and error rates appear deceptively nominal.
* **Audit Ledger DB**: Checking ledger state via `POST /api/agent/probe` with `query_db` reveals massive discrepancies between expected balances and settled ledger transactions.
* **Distractor Trap**: Naive models that only inspect log error counts assume the system is healthy and immediately submit a pass, scoring 0 points on recovery.

### C. Blast Radius & Traps
* Relying on superficial log metrics without running `query_db` audit queries leads to immediate failure.

### D. Remediation
* **Proper Fix Options**:
  1. Pin schema registry version to `v2.4-pinned`:
     ```json
     POST /api/agent/apply
     { "type": "CONFIG_UPDATE", "key": "worker.schema_registry_version", "value": "v2.4-pinned" }
     ```
  2. Enforce strict enum validation (disable default fallback):
     ```json
     POST /api/agent/apply
     { "type": "CONFIG_UPDATE", "key": "worker.strict_enum_validation", "value": true }
     ```
  3. Reconcile corrupted ledger invariants:
     ```json
     POST /api/agent/apply
     { "type": "SERVICE_ACTION", "action": "RECONCILE_LEDGER_INVARIANTS" }
     ```
* **RCA Submission**:
  * `root_cause_service`: `"worker"` or `"db"`
  * `failure_category`: `"SCHEMA_REGISTRY_DRIFT"`
  * `triggering_condition`: Protobuf schema enum ordinal desync caused silent financial ledger invariant poisoning.
