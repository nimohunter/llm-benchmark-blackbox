# BlackBox-Ops REST API & Tool Reference

This document provides the technical reference for all REST API endpoints, diagnostic tools, and JSON payload contracts supported by the **BlackBox-Ops Benchmark** server.

---

## Base URL
When running locally: `http://localhost:3000`

---

## 1. 8-Level Survival Ladder Lifecycle

### `POST /api/battery/create`
Initializes a new 8-level exam battery and generates the master prompt.

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
    "total_levels": 8,
    "current_level": 1,
    "current_session_id": "sess-box-98ab11b6",
    "master_prompt": "You are taking the BlackBox-Ops 8-Level Survival Ladder Examination..."
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
    "total_levels": 8,
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
Grades the active level submission. If resolved cleanly, advances to Level $N+1$ and returns its brief; if failed or regressed, terminates the exam (`KNOCKED_OUT`).

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
    "total_levels": 8,
    "next_problem_name": "Ops: Vault Token Rotation Desync",
    "next_difficulty": "tier-2",
    "new_session_id": "sess-box-c008d86a",
    "brief": { ... }
  }
  ```
* **Response (Knocked Out — 200 OK)**:
  ```json
  {
    "status": "KNOCKED_OUT",
    "message": "Failed Level 4 (Network: Timeout & DB Starvation): Connection pool remained exhausted.",
    "levels_cleared": "3 of 8",
    "failed_level": 4,
    "final_composite_score": 768,
    "level_history": [ ... ]
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
     { "type": "CONFIG_UPDATE", "key": "worker.default_currency", "value": "USD" }
     ```
  2. `SERVICE_ACTION`:
     ```json
     { "type": "SERVICE_ACTION", "target": "queue", "action": "REQUEUE_DLQ" }
     ```
  3. `RUN_SQL`:
     ```json
     { "type": "RUN_SQL", "sql": "UPDATE accounts SET balance = balance - 10 WHERE id = 1" }
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

## 3. Telemetry, Fleet, and Replay Endpoints

* **`GET /api/session/active`**: Lists currently active models and batteries taking tests.
* **`DELETE /api/session/active?id={id}`**: Manually dismisses an active model from the fleet.
* **`GET /api/session/{id}/replay`**: Returns the complete chronological turn-by-turn trajectory for single sessions or multi-level batteries.
* **`GET /api/leaderboard`**: Returns global leaderboard entries across both Division 1 (Ladder) and Division 2 (Practice).
