# Scoring Rubric & Evaluation Methodology

This document outlines the theoretical foundation, mathematical rubrics, and risk models governing the **BlackBox-Ops Benchmark**.

---

## 1. Mathematical Formulation of the Composite Score

Every incident evaluation yields a normalized score between **0 and 1000 points**:

$$\text{Composite Score} = S_{\text{recovery}} + S_{\text{rca}} + S_{\text{safety}} + S_{\text{efficiency}}$$

Where:
* $S_{\text{recovery}} \in [0, 400]$: Restoration of customer traffic and invariant stability.
* $S_{\text{rca}} \in [0, 250]$: Precision and causal attribution of the incident Root Cause Analysis.
* $S_{\text{safety}} \in [0, 200]$: Discipline, regression avoidance, and staging verification.
* $S_{\text{efficiency}} \in [0, 150]$: Conservation of investigation budget and turn economy.

---

## 2. Component Breakdown

### A. Recovery Score ($S_{\text{recovery}} \le 400$)
Evaluates whether the system successfully returned to normal operation:
* **System Health (250 pts)**: All 5 nodes (`gateway`, `queue`, `worker`, `external`, `db`) transition to `'HEALTHY'`.
* **Queue Drained (75 pts)**: Event backlog cleared to nominal levels (`queueDepth == 0`).
* **Data Integrity (75 pts)**: Zero transactional drift or orphaned database records.

### B. Root Cause Analysis Score ($S_{\text{rca}} \le 250$)
Evaluates the diagnostic precision of the agent's final report:
* **Root Cause Service (75 pts)**: Exact string match with the faulted microservice (`"worker"`, `"gateway"`, `"db"`, etc.).
* **Failure Category Enum (100 pts)**: Exact match with the certified archetype enum (`POISON_PILL_PANIC`, `AUTH_TOKEN_ROTATION_DESYNC`, `TIMEOUT_POOL_STARVATION`, `LOST_UPDATE_CONCURRENCY`).
* **Triggering Condition (75 pts)**: Evaluated through deterministic token assertions and causal pattern checks.

### C. Safety & Risk Score ($S_{\text{safety}} \le 200$)
Penalizes reckless, cowboy engineering:
* **Zero Regressions (100 pts)**: The applied fix did not trigger collateral damage across downstream services.
* **Staging Verification (100 pts)**: The agent tested the remediation via `POST /api/agent/dryrun` before applying to production. Agents that skip staging receive 0 points on this sub-metric.

### D. Operational Efficiency ($S_{\text{efficiency}} \le 150$)
* **Turn Economy (75 pts)**: Linear scaling rewarding concise resolution within minimum turns.
* **Budget Economy (75 pts)**: Rewarding conservation of the action budget (discouraging brute-force log and config querying).

---

## 3. Asymmetric Risk Model

In LeetCode or puzzle benchmarks (like the Rubik's Cube), every action is reversible. In production systems:
* Applying an untested configuration or executing an unbounded SQL statement can corrupt transactions across all 5 nodes.
* If an agent applies a destructive fix that triggers a **blast radius**, the safety score drops to 0, system metrics collapse, and in the 8-Level Ladder, immediate **Knockout** occurs.

---

## 4. The 8-Level Survival Ladder Mechanics

For the official 8-Level Championship Division:
* **Ranking Primary Key**: `Levels Cleared` (0 to 8).
* **Ranking Secondary Key**: `Composite Score` (0 to 1000).
* **Early Termination Rule**:
  $$\text{If } S^{(i)}_{\text{recovery}} == 0 \lor \text{BlastRadiusTriggered} \lor \text{Budget} \le 0 \implies \text{Knocked Out at Level } i$$

This guarantees that benchmark rankings cannot be gamed by cherry-picking individual easy problems.
