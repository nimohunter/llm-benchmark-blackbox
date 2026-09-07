# BlackBox-Ops REST API & Tool Reference

This document provides the technical reference for all REST API endpoints, diagnostic tools, and JSON payload contracts supported by the **BlackBox-Ops Benchmark** server.

---

## Base URL
* **Local Development**: `http://localhost:3000`
* **Production Deployment**: `https://blackbox-rho.vercel.app`
* **Live Spectator Arena**: `/live` (e.g. `https://blackbox-rho.vercel.app/live`)

---

## 1. 10-Level Grandmaster Survival Ladder Lifecycle

### `POST /api/battery/create`
Initializes a new 10-level Grandmaster exam battery and generates the autonomous master prompt.

* **Request Body**:
  ```json
  {
    "model_name": "Claude-Opus-5"
  }
  ```
* **Response (200 OK)**:
  ```json
  {
    "success": true,
    "battery_id": "bat-exam-bdcd5e45",
    "model_name": "Claude-Opus-5",
    "total_levels": 10,
    "current_level": 1,
    "current_session_id": "sess-box-98ab11b6",
    "master_prompt": "You are taking the BlackBox-Ops 10-Level Grandmaster Survival Ladder Examination..."
  }
  ```

---

### `GET /api/battery/{id}/current`
Retrieves the active level index, problem brief, and active session ID for the battery.

* **Path Parameters**: `id` (Battery ID, e.g. `bat-exam-bdcd5e45`)
* **Response (200 OK)**:
  ```json
  {
    "battery_id": "bat-exam-bdcd5e45",
    "model_name": "Claude-Opus-5",
    "status": "IN_PROGRESS",
    "current_level": 1,
    "total_levels": 10,
    "level_config": {
      "level": 1,
      "name": "Queue: Deserialization Panic",
      "domain": "Queue",
      "difficulty": "tier-1",
      "summary": "Explicit stack trace in worker deserializer; missing currency key."
    },
    "current_session_id": "sess-box-98ab11b6",
    "brief": {
      "session_id": "sess-box-98ab11b6",
      "incident_name": "Queue: Deserialization Panic",
      "budget_remaining": 100,
      "alert": "CRITICAL ALERT: Consumer worker pod crash looping on deserializer error.",
      "topology": { ... },
      "tools_available": ["get_logs", "get_configs", "inspect_queue", "query_db", "ping_service"]
    }
  }
  ```

---

### `POST /api/battery/{id}/advance`
Grades the active level submission. If resolved cleanly, advances to Level +1$ and returns its brief; if failed or regressed, terminates the exam (`KNOCKED_OUT`).

* **Request Body**:
  ```json
  {
    "session_id": "sess-box-98ab11b6",
    "root_cause_service": "worker",
    "failure_category": "POISON_PILL_PANIC",
    "triggering_condition": "Missing currency_code in event payload causes unhandled TypeError in worker deserializer."
  }
  ```
* **Response (Level Cleared — 200 OK)**:
  ```json
  {
    "status": "LEVEL_CLEARED",
    "message": "Level 1 Cleared with 980/1000 pts! Auto-loading Level 2...",
    "cleared_level": 1,
    "cleared_score": { "total": 980, "recovery": 400, "rcaAccuracy": 250, "safety": 200, "efficiency": 130 },
    "next_level": 2,
    "total_levels": 10,
    "next_problem_name": "Ops: Vault Token Rotation Desync",
    "next_difficulty": "tier-2",
    "new_session_id": "sess-box-c008d86a",
    "brief": { ... }
  }
  ```
* **Response (Grandmaster Certified — 200 OK)**:
  ```json
  {
    "status": "BATTERY_COMPLETED",
    "message": "🏆 GRANDMASTER SRE CERTIFIED! Cleared all 10 levels with 9,240 / 10,000 points!",
    "levels_cleared": "10 of 10",
    "final_composite_score": 924,
    "level_history": [ ... ]
  }
  ```
* **Response (Knocked Out — 200 OK)**:
  ```json
  {
    "status": "KNOCKED_OUT",
    "message": "Failed Level 5 (Cache: Thundering Herd & Cache Stampede): Kernel OOM triggered.",
    "levels_cleared": "4 of 10",
    "failed_level": 5,
    "final_composite_score": 384,
    "level_history": [ ... ]
  }
  ```

---

### `GET /api/battery/{id}/status`
Returns live ladder progress, levels cleared, current in-flight session data (including real-time turns and metrics), and historical level results.

* **Response (200 OK)**:
  ```json
  {
    "battery_id": "bat-exam-bdcd5e45",
    "model_name": "Claude-Opus-5",
    "current_level": 3,
    "total_levels": 10,
    "status": "IN_PROGRESS",
    "levels_cleared": 2,
    "current_session": {
      "session_id": "sess-box-f982a1c0",
      "turn_number": 5,
      "budget_remaining": 82,
      "services": { ... },
      "turns": [ ... ]
    },
    "results": [ ... ]
  }
  ```

---

## 2. Agent Diagnostic & Action Endpoints

### `GET /api/agent/brief/{session_id}`
Returns incident details, current health metrics, topology graph, and available tools.

---

### `POST /api/agent/probe`
Executes non-destructive investigation tools.

* **Cost**: 1 to 2 budget units per call.
* **Tools**:
  * **`get_logs`**:
    ```json
    { "session_id": "...", "tool": "get_logs", "params": { "service": "worker", "limit": 20 } }
    ```
  * **`get_configs`**:
    ```json
    { "session_id": "...", "tool": "get_configs", "params": { "service": "worker" } }
    ```
  * **`inspect_queue`**:
    ```json
    { "session_id": "...", "tool": "inspect_queue", "params": {} }
    ```
  * **`query_db`**:
    ```json
    { "session_id": "...", "tool": "query_db", "params": { "query": "SELECT * FROM ledger LIMIT 10" } }
    ```
  * **`ping_service`**:
    ```json
    { "session_id": "...", "tool": "ping_service", "params": { "service": "external" } }
    ```

---

### `POST /api/agent/dryrun`
Tests a remediation in an isolated staging sandbox without touching production.

* **Cost**: 2 budget units.
* **Request Body**:
  ```json
  {
    "session_id": "sess-box-xxxx",
    "remediation": {
      "type": "SERVICE_ACTION",
      "target": "queue",
      "action": "REQUEUE_DLQ"
    }
  }
  ```
* **Response**:
  ```json
  {
    "status": "SUCCESS",
    "message": "Poison message quarantined to DLQ. 0 regressions detected.",
    "regressions_detected": 0,
    "advice": "Staging passed. Safe to apply to production."
  }
  ```

---

### `POST /api/agent/apply`
Applies the remediation directly to the live production state machine.

* **Cost**: 3 to 5 budget units.
* **Remediation Types**:
  1. `CONFIG_UPDATE`:
     ```json
     { "type": "CONFIG_UPDATE", "key": "cache.singleflight_mutex", "value": true }
     ```
  2. `SERVICE_ACTION`:
     ```json
     { "type": "SERVICE_ACTION", "target": "gateway", "action": "FLUSH_AUTH_CACHE" }
     ```
  3. `RUN_SQL`:
     ```json
     { "type": "RUN_SQL", "sql": "UPDATE accounts SET balance = balance - 10 WHERE id = 1;" }
     ```

---

### `POST /api/agent/finish`
Concludes a single practice session and grades the final score.

* **Request Body**:
  ```json
  {
    "session_id": "sess-box-xxxx",
    "root_cause_service": "worker",
    "failure_category": "POISON_PILL_PANIC",
    "triggering_condition": "Missing currency_code key in JSON payload"
  }
  ```
* **Response**:
  ```json
  {
    "score": {
      "recovery": 400,
      "rcaAccuracy": 250,
      "safety": 200,
      "efficiency": 121,
      "total": 896
    },
    "summary": "Session finished with score 896/1000."
  }
  ```

---

## 3. Telemetry, Fleet, and Live Replay Endpoints

### `GET /api/session/active`
Returns all active and recently active models and ladder batteries currently undergoing evaluation.
* **Persistence**: Synchronized across edge nodes via Upstash Redis (`KV_REST_API_*`) or local JSON fallback.
* **Spectator Payloads**: Includes `current_session` object containing real-time turns, active dials, and streaming logs so any online visitor can observe live tests.
* **Abandoned Agent Cleanup**: Inactive sessions older than 10 minutes are filtered or pruned automatically.

### `DELETE /api/session/active?id={id}`
Manually dismisses an active model or battery from the live HUD.

### `GET /api/session/{id}/replay`
Returns the complete chronological turn-by-turn trajectory for single sessions or multi-level batteries (including in-flight active turns).

### `GET /api/leaderboard`
Returns global leaderboard entries across both Division 1 (10-Level Ladder) and Division 2 (Practice Drills).

---

## 4. Online Live Task Arena (`/live`)

The benchmark platform includes a dedicated real-time spectator arena accessible at **`/live`**:
* **Multi-Model Fleet Selector**: Switch between active model runs (Claude, GPT, Gemini, DeepSeek).
* **Dynamic 5-Node Topology Radar**: Visual SVG mesh displaying live health, error rates, and connection pools.
* **Live Streaming Action Terminal**: Auto-scrolling HUD showing real-time `probe`, `dryrun`, `apply`, and `advance` agent calls with color-coded syntax.
* **10-Level Progress Tracker**: Shows ladder checkpoints, cleared levels, and current incident status.
* **Battery-Friendly Polling**: Includes automatic 2.5s polling with background tab throttling (`document.visibilityState === 'hidden'`) to conserve bandwidth and edge compute.
