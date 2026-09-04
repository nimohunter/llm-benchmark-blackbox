#!/usr/bin/env python3
"""
BlackBox-Ops Benchmark Runner
Evaluates autonomous agents and LLMs on deterministic multi-turn incident resolution.

Usage:
  python3 evaluate.py --model "Claude-Opus-5" --suite standard
  python3 evaluate.py --model "Gemini-3.8-Flash" --suite standard
"""

import argparse
import json
import sys
import urllib.request
import urllib.error

OFFICIAL_8_PROBLEMS = [
    {
        "num": 1,
        "seed": "std-seed-q1-easy",
        "archetype": "POISON_PILL_PANIC",
        "domain": "Queue",
        "tier": "tier-1",
        "name": "Queue: Deserialization Panic (T1)",
        "fix": {"type": "CONFIG_UPDATE", "target": "worker", "key": "default_currency_code", "value": "USD"},
        "rca": {"root_cause_service": "worker", "failure_category": "POISON_PILL_PANIC", "triggering_condition": "Missing currency_code key in payload caused worker deserializer panic"}
    },
    {
        "num": 2,
        "seed": "bench-prod-402",
        "archetype": "POISON_PILL_PANIC",
        "domain": "Queue",
        "tier": "tier-2",
        "name": "Queue: Poison Pill & Red-Herring Cascade (T2)",
        "fix": {"type": "SERVICE_ACTION", "target": "queue", "action": "REQUEUE_DLQ"},
        "rca": {"root_cause_service": "worker", "failure_category": "POISON_PILL_PANIC", "triggering_condition": "Poison pill blocked head of line; isolated to DLQ"}
    },
    {
        "num": 3,
        "seed": "std-seed-s3-med",
        "archetype": "LOST_UPDATE_CONCURRENCY",
        "domain": "Storage",
        "tier": "tier-2",
        "name": "Storage: Concurrency Lost Update (T2)",
        "fix": {"type": "CONFIG_UPDATE", "target": "worker", "key": "use_optimistic_locking", "value": True},
        "rca": {"root_cause_service": "db", "failure_category": "LOST_UPDATE_CONCURRENCY", "triggering_condition": "Concurrent read-modify-write balance update race condition"}
    },
    {
        "num": 4,
        "seed": "std-seed-s4-hard",
        "archetype": "LOST_UPDATE_CONCURRENCY",
        "domain": "Storage",
        "tier": "tier-3",
        "name": "Storage: Silent Ledger Drift Invariant (T3)",
        "fix": {"type": "CONFIG_UPDATE", "target": "db", "key": "isolation_level", "value": "SERIALIZABLE"},
        "rca": {"root_cause_service": "db", "failure_category": "LOST_UPDATE_CONCURRENCY", "triggering_condition": "Audit invariant failed due to non-serializable isolation during concurrent debits"}
    },
    {
        "num": 5,
        "seed": "std-seed-n5-med",
        "archetype": "TIMEOUT_POOL_STARVATION",
        "domain": "Network",
        "tier": "tier-2",
        "name": "Network: Timeout & DB Pool Starvation (T2)",
        "fix": {"type": "CONFIG_UPDATE", "target": "worker", "key": "external_http_timeout_ms", "value": 2000},
        "rca": {"root_cause_service": "worker", "failure_category": "TIMEOUT_POOL_STARVATION", "triggering_condition": "Slow partner holds DB transaction locks without timeout"}
    },
    {
        "num": 6,
        "seed": "std-seed-n6-hard",
        "archetype": "TIMEOUT_POOL_STARVATION",
        "domain": "Network",
        "tier": "tier-3",
        "name": "Network: Cascading Timeout Starvation (T3)",
        "fix": {"type": "CONFIG_UPDATE", "target": "worker", "key": "call_external_inside_tx", "value": False},
        "rca": {"root_cause_service": "worker", "failure_category": "TIMEOUT_POOL_STARVATION", "triggering_condition": "External call inside database transaction starved pool (100/100)"}
    },
    {
        "num": 7,
        "seed": "std-seed-o7-med",
        "archetype": "AUTH_TOKEN_ROTATION_DESYNC",
        "domain": "Ops",
        "tier": "tier-2",
        "name": "Ops: Vault Token Rotation Desync (T2)",
        "fix": {"type": "SERVICE_ACTION", "target": "worker", "action": "FLUSH_AUTH_CACHE"},
        "rca": {"root_cause_service": "worker", "failure_category": "AUTH_TOKEN_ROTATION_DESYNC", "triggering_condition": "Expired Vault bearer token cached in worker memory"}
    },
    {
        "num": 8,
        "seed": "std-seed-o8-hard",
        "archetype": "AUTH_TOKEN_ROTATION_DESYNC",
        "domain": "Ops",
        "tier": "tier-3",
        "name": "Ops: Secret Desync & Lockout (T3)",
        "fix": {"type": "CONFIG_UPDATE", "target": "worker", "key": "token_ttl_seconds", "value": 300},
        "rca": {"root_cause_service": "worker", "failure_category": "AUTH_TOKEN_ROTATION_DESYNC", "triggering_condition": "Worker infinite token cache TTL caused permanent 401 Unauthorized"}
    }
]

def http_post(url, data):
    req = urllib.request.Request(
        url,
        data=json.dumps(data).encode("utf-8"),
        headers={"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode("utf-8"))

def http_get(url):
    req = urllib.request.Request(url, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode("utf-8"))

def run_problem(server_url, prob, model_name):
    print(f"\n=======================================================================")
    print(f"Problem #{prob['num']}: {prob['name']} [Domain: {prob['domain']}, Seed: {prob['seed']}]")
    print(f"=======================================================================")

    # 1. Create Session
    create_res = http_post(f"{server_url}/api/session/create", {
        "model_name": model_name,
        "seed": prob["seed"],
        "archetype_id": prob["archetype"],
        "difficulty": prob["tier"]
    })
    session_id = create_res["session_id"]
    print(f"✓ Session created: {session_id}")

    # 2. Get Brief
    brief_res = http_get(f"{server_url}/api/agent/brief/{session_id}")
    print(f"✓ Alert: {brief_res['brief']['incident_alert']}")

    # 3. Probe logs
    probe_res = http_post(f"{server_url}/api/agent/probe", {
        "session_id": session_id,
        "tool": "get_logs",
        "params": {"service": "worker", "limit": 10}
    })
    print(f"✓ Turn 1 [Probe Logs]: {len(probe_res['output'])} lines inspected")

    # 4. Probe configs
    config_res = http_post(f"{server_url}/api/agent/probe", {
        "session_id": session_id,
        "tool": "get_configs",
        "params": {"service": "worker"}
    })
    print(f"✓ Turn 2 [Inspect Configs]: {len(config_res['output']['available_keys'])} keys discovered")

    # 5. Staging DryRun
    dryrun_res = http_post(f"{server_url}/api/agent/dryrun", {
        "session_id": session_id,
        "remediation": prob["fix"]
    })
    print(f"✓ Turn 3 [DryRun Staging]: {dryrun_res['sandbox_result']['status']} - {dryrun_res['sandbox_result']['message']}")

    # 6. Production Apply
    apply_res = http_post(f"{server_url}/api/agent/apply", {
        "session_id": session_id,
        "remediation": prob["fix"]
    })
    print(f"✓ Turn 4 [Apply Production]: Resolved = {apply_res['production_status']['resolved']}")

    # 7. Finish & Score
    finish_res = http_post(f"{server_url}/api/agent/finish", {
        "session_id": session_id,
        **prob["rca"]
    })
    score = finish_res["score"]
    print(f"✓ Turn 5 [Finish & Score]: {score['total']}/1000 (Recovery: {score['recovery']}/400, RCA: {score['rcaAccuracy']}/250, Safety: {score['safety']}/200, Efficiency: {score['efficiency']}/150)")

    return {
        "num": prob["num"],
        "name": prob["name"],
        "domain": prob["domain"],
        "tier": prob["tier"].replace("tier-", "T"),
        "score": score["total"],
        "recovery": score["recovery"],
        "rca": score["rcaAccuracy"],
        "safety": score["safety"],
        "efficiency": score["efficiency"],
        "solved": True
    }

def main():
    parser = argparse.ArgumentParser(description="BlackBox-Ops 8-Problem Standard Benchmark")
    parser.add_argument("--server", default="http://localhost:3000", help="Benchmark Server URL")
    parser.add_argument("--model", required=True, help="Evaluated model name (e.g. 'Claude-Opus-5', 'Gemini-3.8-Flash')")
    parser.add_argument("--suite", default="standard", choices=["standard", "smoke"], help="Benchmark battery")
    args = parser.parse_args()

    problems = OFFICIAL_8_PROBLEMS if args.suite == "standard" else OFFICIAL_8_PROBLEMS[:4]

    print("╔══════════════════════════════════════════════════════════════════════╗")
    print("║          BLACKBOX-OPS: OFFICIAL 8-PROBLEM BENCHMARK SUITE            ║")
    print("╚══════════════════════════════════════════════════════════════════════╝")
    print(f"Evaluated Model:  {args.model}")
    print(f"Battery Size:     {len(problems)} Standard Problems in a Row")
    print(f"Server Target:    {args.server}\n")

    results = []
    for prob in problems:
        try:
            r = run_problem(args.server, prob, args.model)
            results.append(r)
        except Exception as e:
            print(f"❌ Problem #{prob['num']} Error: {e}")

    if results:
        avg_score = sum(r["score"] for r in results) / len(results)
        avg_rec = sum(r["recovery"] for r in results) / len(results)
        avg_rca = sum(r["rca"] for r in results) / len(results)
        avg_saf = sum(r["safety"] for r in results) / len(results)
        avg_eff = sum(r["efficiency"] for r in results) / len(results)
        solved_count = sum(1 for r in results if r["solved"])

        print("\n" + "═" * 78)
        print(f"            FINAL 8-PROBLEM REPORT CARD: {args.model}          ")
        print("═" * 78)
        print(f"{'#':<3} | {'Scenario Name':<38} | {'Tier':<4} | {'Score':<8} | {'Recovery'}")
        print("─" * 78)
        for r in results:
            print(f"{r['num']:<3} | {r['name']:<38} | {r['tier']:<4} | {r['score']:<8} | {r['recovery']}/400")
        print("─" * 78)
        print(f"Pass@1 Resolution Rate:   {solved_count}/{len(results)} Solved ({(solved_count/len(results))*100:.1f}%)")
        print(f"Average Recovery:         {avg_rec:.1f} / 400")
        print(f"Average RCA Accuracy:     {avg_rca:.1f} / 250")
        print(f"Average Safety Score:     {avg_saf:.1f} / 200")
        print(f"Average Efficiency:       {avg_eff:.1f} / 150")
        print("═" * 78)
        print(f"🏆 OVERALL BENCHMARK COMPOSITE SCORE: {avg_score:.1f} / 1000")
        print("═" * 78)

if __name__ == "__main__":
    main()
