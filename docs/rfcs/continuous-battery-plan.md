# BlackBox-Ops: The 8-Level Survival Ladder ("One-Prompt, 8-Puzzle Exam")

> An agentic benchmark mode allowing testers to copy **ONE single prompt** into any LLM chat (Claude, Gemini, ChatGPT) that autonomously guides the model through an ascending difficulty ladder of **8 certified engineering puzzles**, terminating early upon failure and awarding a grandmaster score for clearing all 8.

---

## 1. Core Architecture & Philosophy

Rather than making humans copy-paste 8 separate prompts or manage 8 disjointed chats:
* The tester enters the model name once and gets **ONE single Master Exam Prompt**.
* The exam is organized as an **ascending difficulty ladder** from Level 1 (Easy) to Level 8 (Nightmare).
* **Early Termination (Fail-Fast)**: If a model fails to resolve a level, triggers a catastrophic blast-radius regression, or exhausts its budget, the exam terminates immediately. We don't waste tokens testing harder levels if the model can't pass earlier levels.
* **Continuous In-Chat Progression**: Each time the model calls `advance`, the server evaluates the current level and, if passed, **immediately loads the fresh broken state for the next level** in that exact same response.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          THE 8-LEVEL SURVIVAL LADDER                        │
├──────┬──────────────┬────────────────────────────────────┬──────────────────┤
│ Level│ Difficulty   │ Problem Name                       │ Knockout Check   │
├──────┼──────────────┼────────────────────────────────────┼──────────────────┤
│ L1   │ Tier 1       │ Queue: Deserialization Panic       │ Stack trace fix  │
│ L2   │ Tier 1.5     │ Ops: Vault Token Rotation Desync   │ Stale auth cache │
│ L3   │ Tier 2       │ Queue: Poison Pill & Red-Herring   │ Distractor 503   │
│ L4   │ Tier 2       │ Network: Timeout & Pool Starvation │ Connection pool  │
│ L5   │ Tier 2.5     │ Storage: Concurrency Lost Update   │ Optimistic lock  │
│ L6   │ Tier 3       │ Network: Cascading Lock Leak       │ Multi-svc outage │
│ L7   │ Tier 3       │ Ops: Secret Desync & Lockout       │ High-concurr auth│
│ L8   │ Tier 3.5     │ Storage: Silent Ledger Drift (Boss)│ 200 OK no logs!  │
└──────┴──────────────┴────────────────────────────────────┴──────────────────┘
       │                                                    │
       ▼ Cleared: Auto-loads Level N+1                      ▼ Failed: TERMINATES EARLY
[Clears all 8 -> Grandmaster Diploma (0-1000)]        [Knocked out -> "Level X Cleared"]
```

---

## 2. API Endpoints

1. **`POST /api/battery/create`**:
   * Request: `{ "model_name": "Claude-Opus-5" }`
   * Response: `{ "battery_id": "bat-xxx", "total_levels": 8, "prompt": "..." }`
2. **`GET /api/battery/{battery_id}/current`**:
   * Returns active level number (e.g. `Level 3 of 8`), current problem brief, and `session_id`.
3. **`POST /api/battery/{battery_id}/advance`**:
   * Request: `{ "session_id": "...", "root_cause_service": "...", "failure_category": "...", "triggering_condition": "..." }`
   * Logic:
     * Evaluates current level.
     * If **RESOLVED**: Records score. If Level < 8, loads Level $N+1$ and returns its brief. If Level == 8, awards final diploma!
     * If **FAILED**: Sets status to `KNOCKED_OUT`, records final level cleared, logs to leaderboard, and ends exam.
4. **`GET /api/battery/{battery_id}/status`**:
   * Returns live progress, levels cleared, and score breakdown.

---

## 3. Web UI & Leaderboard Integration

* **Prompt Kit**: 1-click button: **"Generate 8-Level Survival Exam Prompt"**.
* **Live Telemetry HUD**: Shows `Survival Ladder: Level X / 8 (Current: Level Name)` with pulsating beacons.
* **Leaderboard**: Displays `Levels Cleared: 8/8 (Cleared 🏆)` or `L3/8 (Knocked Out)`.
