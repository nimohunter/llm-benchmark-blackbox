# Agent Integration & Evaluation Guide

This guide explains how to connect autonomous AI agents (LangChain, AutoGen, CrewAI, or raw LLM tool-calling loops) to the **BlackBox-Ops** benchmark.

---

## 1. Quickstart: CLI Evaluation Runner

The repository includes a ready-to-run evaluation runner: [`evaluate.py`](../evaluate.py).

### Running the Standard Battery
```bash
# Evaluate a model on the 10-Level Grandmaster Battery
python3 evaluate.py --model "Claude-Opus-5" --suite standard
```

### Running an Isolated Scenario
```bash
python3 evaluate.py --model "Claude-Sonnet-5" --seed "bench-prod-402" --archetype "POISON_PILL_PANIC"
```

---

## 2. Integrating with Tool-Calling Agents (OpenAI / Anthropic / LangChain)

BlackBox-Ops exposes standard HTTP REST endpoints that map directly to agent tool calls.

### Schema Definition (JSON Function Calling)
```json
[
  {
    "name": "probe_service",
    "description": "Probe logs, configs, queues, or databases under partial observability.",
    "parameters": {
      "type": "object",
      "properties": {
        "tool": { "type": "string", "enum": ["get_logs", "get_configs", "inspect_queue", "query_db", "ping_service"] },
        "params": { "type": "object" }
      },
      "required": ["tool"]
    }
  },
  {
    "name": "dryrun_remediation",
    "description": "Test a fix safely in the staging sandbox before deploying to production.",
    "parameters": {
      "type": "object",
      "properties": {
        "type": { "type": "string", "enum": ["CONFIG_UPDATE", "SERVICE_ACTION", "RUN_SQL"] },
        "target": { "type": "string" },
        "action": { "type": "string" },
        "key": { "type": "string" },
        "value": { "type": "string" },
        "sql": { "type": "string" }
      },
      "required": ["type"]
    }
  },
  {
    "name": "apply_remediation",
    "description": "Apply a remediation directly to the production state machine.",
    "parameters": {
      "type": "object",
      "properties": {
        "type": { "type": "string", "enum": ["CONFIG_UPDATE", "SERVICE_ACTION", "RUN_SQL"] },
        "target": { "type": "string" },
        "action": { "type": "string" },
        "key": { "type": "string" },
        "value": { "type": "string" },
        "sql": { "type": "string" }
      },
      "required": ["type"]
    }
  },
  {
    "name": "advance_level",
    "description": "Submit Root Cause Analysis (RCA) and advance to the next ladder level.",
    "parameters": {
      "type": "object",
      "properties": {
        "root_cause_service": { "type": "string" },
        "failure_category": { 
          "type": "string", 
          "enum": [
            "POISON_PILL_PANIC",
            "AUTH_TOKEN_ROTATION_DESYNC",
            "LOST_UPDATE_CONCURRENCY",
            "TIMEOUT_POOL_STARVATION",
            "CACHE_STAMPEDE_THUNDERING_HERD",
            "MEMORY_LEAK_OOM_CASCADE",
            "DISTRIBUTED_SAGA_DEADLOCK",
            "CLOCK_SKEW_BYZANTINE_DRIFT",
            "SPLIT_BRAIN_PARTITION",
            "SCHEMA_REGISTRY_DRIFT"
          ] 
        },
        "triggering_condition": { "type": "string" }
      },
      "required": ["root_cause_service", "failure_category", "triggering_condition"]
    }
  }
]
```

---

## 3. Minimal Python Agentic Loop Example

```python
import requests

BASE_URL = "http://localhost:3000"

def run_ladder_exam(model_name="My-Custom-Agent"):
    # 1. Initialize Battery
    res = requests.post(f"{BASE_URL}/api/battery/create", json={"model_name": model_name}).json()
    battery_id = res["battery_id"]
    print(f"Started 10-Level Exam: {battery_id}")

    while True:
        # 2. Get current level brief
        curr = requests.get(f"{BASE_URL}/api/battery/{battery_id}/current").json()
        if curr.get("status") in ["COMPLETED", "KNOCKED_OUT"]:
            break
            
        session_id = curr["current_session_id"]
        level = curr["current_level"]
        print(f"
--- Entering Level {level}: {curr['level_config']['name']} ---")

        # 3. Agent probes logs
        logs = requests.post(f"{BASE_URL}/api/agent/probe", json={
            "session_id": session_id,
            "tool": "get_logs",
            "params": {"service": "worker", "limit": 10}
        }).json()

        # 4. Agent dry-runs fix on staging
        dryrun = requests.post(f"{BASE_URL}/api/agent/dryrun", json={
            "session_id": session_id,
            "remediation": {"type": "SERVICE_ACTION", "target": "queue", "action": "REQUEUE_DLQ"}
        }).json()
        print(f"Staging Dryrun Result: {dryrun.get('status')}")

        # 5. Agent applies fix to production
        apply_res = requests.post(f"{BASE_URL}/api/agent/apply", json={
            "session_id": session_id,
            "remediation": {"type": "SERVICE_ACTION", "target": "queue", "action": "REQUEUE_DLQ"}
        }).json()

        # 6. Submit RCA and advance
        adv = requests.post(f"{BASE_URL}/api/battery/{battery_id}/advance", json={
            "session_id": session_id,
            "root_cause_service": "queue",
            "failure_category": "POISON_PILL_PANIC",
            "triggering_condition": "Poison payload caused crash loop at head of queue"
        }).json()
        
        print(f"Advance Status: {adv.get('status')}")
        if adv.get("status") == "KNOCKED_OUT":
            print(f"Exam concluded: {adv.get('message')}")
            break
        elif adv.get("status") == "BATTERY_COMPLETED":
            print("🏆 Grandmaster SRE Certified! All 10 levels cleared!")
            break

if __name__ == "__main__":
    run_ladder_exam()
```
