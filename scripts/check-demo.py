#!/usr/bin/env python3
"""Exercise the real demo API; report warm timings separately from the first pass."""
import argparse
import json
import statistics
import time
import urllib.request

CASES = [
    ("High-value GBP", "I have a customer, 'London Tech Ltd', trying to move £12,500 to a new vendor in Estonia for 'Cloud Services'. Before I approve this, check our local AML rules.", "REJECTED", 12500, "GBP"),
    ("Standard GBP", "Please verify a £3,200 GBP payment from 'Baker Street Consulting' to a domestic supplier for office furniture.", "CLEARED", 3200, "GBP"),
    ("Mid-range GBP", "A customer wants to send £7,500 GBP to a consulting firm in Dublin. Check if this triggers any AML rules.", "WARNING", 7500, "GBP"),
    ("EUR transfer", "Check AML compliance for a €9,000 EUR wire transfer from our Paris branch to a Frankfurt-based logistics company.", "CLEARED", 9000, "EUR"),
]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--url", default="http://localhost:8080")
parser.add_argument("--rounds", type=int, default=3)
args = parser.parse_args()
if args.rounds < 1:
    parser.error("--rounds must be positive")
results = []
for round_number in range(args.rounds):
    for name, prompt, expected, amount, currency in CASES:
        started = time.perf_counter()
        request = urllib.request.Request(args.url + "/trade/analyze", data=prompt.encode(), headers={"Content-Type": "text/plain", "Accept": "application/json"})
        with urllib.request.urlopen(request, timeout=40) as response:
            result = json.load(response)
        decision = result["decision"]
        passed = decision["verdict"] == expected and decision["amount"] == amount and decision["currency"] == currency and decision["ruleId"] is not None
        row = {"round": round_number + 1, "case": name, "model": result["model"], "passed": passed, "seconds": round(time.perf_counter() - started, 3), "decision": decision}
        results.append(row)
        print(json.dumps(row, ensure_ascii=False), flush=True)
warm = [row["seconds"] for row in results if row["round"] > 1]
print(json.dumps({"passed": sum(row["passed"] for row in results), "total": len(results), "warm_median_seconds": statistics.median(warm) if warm else None, "warm_max_seconds": max(warm) if warm else None}), flush=True)
raise SystemExit(0 if all(row["passed"] for row in results) else 1)
