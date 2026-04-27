#!/usr/bin/env python3
"""
NexusFlow — Comprehensive Live Test Suite
==========================================
Runs against the live stack at localhost:8000 / localhost:3000.

Usage:
    python test_nexusflow.py                    # run all tests
    python test_nexusflow.py --quick            # skip slow tests (disruption sim)
    python test_nexusflow.py --backend-url http://localhost:8000

Exit code 0 = all tests passed.
Exit code 1 = one or more failures.
"""

from __future__ import annotations

import argparse
import json
import sys
import time
import urllib.request
import urllib.error
from dataclasses import dataclass, field
from typing import Any

# ── Config ────────────────────────────────────────────────────────────────────

BACKEND = "http://localhost:8000"
FRONTEND = "http://localhost:3000"

# ── Result tracking ───────────────────────────────────────────────────────────

PASS  = "✅ PASS"
FAIL  = "❌ FAIL"
WARN  = "⚠️  WARN"
INFO  = "ℹ️  INFO"

results: list[tuple[str, str, str]] = []  # (status, category, message)


def check(condition: bool, category: str, msg_pass: str, msg_fail: str) -> bool:
    status = PASS if condition else FAIL
    msg    = msg_pass if condition else msg_fail
    results.append((status, category, msg))
    print(f"  {status}  {msg}")
    return condition


def warn(category: str, msg: str) -> None:
    results.append((WARN, category, msg))
    print(f"  {WARN}  {msg}")


def info(category: str, msg: str) -> None:
    results.append((INFO, category, msg))
    print(f"  {INFO}  {msg}")


def section(title: str) -> None:
    print(f"\n{'─'*60}")
    print(f"  {title}")
    print(f"{'─'*60}")


# ── HTTP helpers ──────────────────────────────────────────────────────────────

def get(path: str, timeout: int = 10) -> tuple[int, Any]:
    url = f"{BACKEND}{path}"
    try:
        with urllib.request.urlopen(url, timeout=timeout) as r:
            return r.status, json.loads(r.read())
    except urllib.error.HTTPError as e:
        return e.code, {}
    except Exception as e:
        return 0, {"error": str(e)}


def post(path: str, body: dict, timeout: int = 30) -> tuple[int, Any]:
    url  = f"{BACKEND}{path}"
    data = json.dumps(body).encode()
    req  = urllib.request.Request(
        url, data=data,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.status, json.loads(r.read())
    except urllib.error.HTTPError as e:
        try:
            return e.code, json.loads(e.read())
        except Exception:
            return e.code, {}
    except Exception as e:
        return 0, {"error": str(e)}


def head_check(url: str, timeout: int = 5) -> bool:
    try:
        urllib.request.urlopen(url, timeout=timeout)
        return True
    except Exception:
        return False


# ══════════════════════════════════════════════════════════════════════════════
#  TEST GROUPS
# ══════════════════════════════════════════════════════════════════════════════

def test_connectivity():
    section("1 · CONNECTIVITY")
    code, data = get("/health")
    check(code == 200, "connectivity", "Backend /health → 200", f"Backend unreachable (HTTP {code})")
    if code == 200:
        check(data.get("status") == "ok", "connectivity",
              "Health status = 'ok'", f"Unexpected status: {data.get('status')}")

    fe_ok = head_check(FRONTEND)
    check(fe_ok, "connectivity", "Frontend reachable at localhost:3000",
          "Frontend NOT reachable — is the container running?")


def test_shipment_list(quick: bool) -> list[dict]:
    section("2 · SHIPMENT LIST")
    code, data = get("/api/shipments")
    check(code == 200, "shipments", "GET /api/shipments → 200", f"HTTP {code}")
    if code != 200:
        return []

    shipments = data if isinstance(data, list) else data.get("shipments", [])
    n = len(shipments)
    check(n >= 500, "shipments", f"Dataset size = {n} shipments (≥500)",
          f"Only {n} shipments — NX extras or JSON not loaded")

    # Check required fields
    s = shipments[0] if shipments else {}
    for field_name in ("id", "origin_port", "destination_port", "carrier",
                       "cargo_type", "risk_score", "status", "top_risk_factors", "eta"):
        check(field_name in s, "schema",
              f"Field '{field_name}' present", f"Field '{field_name}' MISSING from shipment")

    return shipments


def test_shap_population(shipments: list[dict]):
    section("3 · SHAP / TOP_RISK_FACTORS")
    if not shipments:
        warn("shap", "No shipments to check — skipping SHAP tests")
        return

    total   = len(shipments)
    with_shap = [s for s in shipments if s.get("top_risk_factors")]
    empty_shap = [s for s in shipments if s.get("top_risk_factors") == []]
    missing_key = [s for s in shipments if "top_risk_factors" not in s]

    pct = len(with_shap) / total * 100
    check(pct >= 95, "shap",
          f"SHAP populated on {len(with_shap)}/{total} shipments ({pct:.1f}%)",
          f"SHAP EMPTY on {total - len(with_shap)}/{total} shipments — ML seeding not working")

    if empty_shap:
        warn("shap", f"{len(empty_shap)} shipments have top_risk_factors=[]")
    if missing_key:
        warn("shap", f"{len(missing_key)} shipments missing top_risk_factors key entirely")

    # Spot-check the structure of a SHAP entry
    sample = next((s for s in shipments if s.get("top_risk_factors")), None)
    if sample:
        rf = sample["top_risk_factors"][0]
        for key in ("factor", "contribution", "direction"):
            check(key in rf, "shap", f"SHAP entry has '{key}' field",
                  f"SHAP entry missing '{key}'")
        check(rf.get("direction") in ("increase", "decrease"), "shap",
              f"direction = '{rf.get('direction')}'",
              f"Invalid direction value: {rf.get('direction')}")


def test_ml_scores(shipments: list[dict]):
    section("4 · ML RISK SCORES — CALIBRATION")
    if not shipments:
        warn("ml", "No shipments — skipping")
        return

    scores = [float(s.get("risk_score", 0)) for s in shipments]
    total  = len(scores)

    high   = sum(1 for s in scores if s > 60)
    medium = sum(1 for s in scores if 40 <= s <= 60)
    low    = sum(1 for s in scores if s < 40)
    high_pct = high / total * 100

    info("ml", f"Risk distribution — High: {high} ({high_pct:.1f}%), "
               f"Medium: {medium} ({medium/total*100:.1f}%), "
               f"Low: {low} ({low/total*100:.1f}%)")

    check(high_pct < 40, "ml",
          f"High-risk rate {high_pct:.1f}% is realistic (< 40%)",
          f"High-risk rate {high_pct:.1f}% is unrealistically high — model calibration issue")

    # Check that scores are ML-derived, not hardcoded
    unique_scores = len(set(scores))
    check(unique_scores > 20, "ml",
          f"{unique_scores} unique risk scores (varied ML output)",
          f"Only {unique_scores} unique scores — may be hardcoded seed values")

    # No shipments stuck at 0.0 (un-scored)
    zero_scores = sum(1 for s in scores if s == 0.0)
    check(zero_scores < total * 0.1, "ml",
          f"< 10% of shipments have risk_score=0 ({zero_scores}/{total})",
          f"{zero_scores}/{total} shipments stuck at 0 — ML seeding skipped")


def test_cargo_data(shipments: list[dict]):
    section("5 · DATA INTEGRITY — CARGO TYPES")
    if not shipments:
        warn("cargo", "No shipments — skipping")
        return

    valid_types = {"PHARMA", "ELECTRONICS", "PERISHABLES", "AUTOMOTIVE",
                   "MACHINERY", "CHEMICALS", "FOOD", "TEXTILES", "GENERAL"}

    bad = [s for s in shipments
           if s.get("cargo_type", "").upper() != s.get("cargo_type", "")]
    check(len(bad) == 0, "cargo",
          "All cargo_types are uppercase",
          f"{len(bad)} shipments have lowercase cargo_type: {[s['id'] for s in bad[:5]]}")

    unknown = [s for s in shipments
               if s.get("cargo_type", "") not in valid_types]
    check(len(unknown) == 0, "cargo",
          "All cargo_types are in CARGO_PRIORITY_WEIGHTS",
          f"{len(unknown)} shipments have unrecognised cargo_type: "
          f"{list(set(s.get('cargo_type') for s in unknown[:5]))}")

    types_present = set(s.get("cargo_type", "") for s in shipments)
    info("cargo", f"Cargo types in dataset: {sorted(types_present)}")


def test_port_data(shipments: list[dict]):
    section("6 · DATA INTEGRITY — PORT NAMES")
    if not shipments:
        warn("ports", "No shipments — skipping")
        return

    bare_dubai = [s for s in shipments
                  if s.get("origin_port") == "Dubai"
                  or s.get("destination_port") == "Dubai"]
    check(len(bare_dubai) == 0, "ports",
          "No bare 'Dubai' port names (all use 'Dubai (Jebel Ali)')",
          f"{len(bare_dubai)} shipments still use bare 'Dubai' — port/distance bugs persist")

    jebel = [s for s in shipments
             if "Jebel" in str(s.get("origin_port", ""))
             or "Jebel" in str(s.get("destination_port", ""))]
    info("ports", f"'Dubai (Jebel Ali)' shipments: {len(jebel)}")


def test_individual_shipment():
    section("7 · INDIVIDUAL SHIPMENT ENDPOINTS")

    # Test NX demo shipment
    code, s = get("/api/shipments/NX1048")
    ok = check(code == 200, "endpoint", "GET /api/shipments/NX1048 → 200",
               f"NX1048 not found (HTTP {code})")
    if ok:
        check(bool(s.get("top_risk_factors")), "endpoint",
              f"NX1048 has SHAP factors ({len(s.get('top_risk_factors',[]))} entries)",
              "NX1048 top_risk_factors is empty")
        info("endpoint", f"NX1048 risk_score = {s.get('risk_score')}, status = {s.get('status')}")

    # Test S-prefixed shipment
    code2, s2 = get("/api/shipments/S001")
    ok2 = check(code2 == 200, "endpoint", "GET /api/shipments/S001 → 200",
                f"S001 not found (HTTP {code2})")
    if ok2:
        check(bool(s2.get("top_risk_factors")), "endpoint",
              "S001 has SHAP factors", "S001 top_risk_factors is empty")

    # Non-existent shipment → 404
    code3, _ = get("/api/shipments/DOESNOTEXIST999")
    check(code3 == 404, "endpoint",
          "GET /api/shipments/DOESNOTEXIST999 → 404 (correct)",
          f"Expected 404, got {code3}")


def test_feature_vector():
    section("8 · FEATURE VECTOR ENDPOINT")

    code, fv = get("/api/shipments/NX1048/features")
    ok = check(code == 200, "features", "GET /api/shipments/NX1048/features → 200",
               f"HTTP {code}")
    if not ok:
        return

    expected_fields = [
        "weather_severity", "origin_congestion", "dest_congestion",
        "carrier_ontime_rate", "cargo_priority_weight",
        "days_until_eta", "route_distance_km",
    ]
    for f in expected_fields:
        check(f in fv, "features", f"Feature '{f}' present", f"Feature '{f}' MISSING")

    # Cargo priority must not be 3 (GENERAL fallback) for NX1048 (carrier=HMM → AUTOMOTIVE → 7)
    cpw = fv.get("cargo_priority_weight", 0)
    check(cpw != 3, "features",
          f"cargo_priority_weight = {cpw} (not the GENERAL fallback of 3)",
          f"cargo_priority_weight = 3 — cargo type lookup is broken (still falling back to GENERAL)")

    # Route distance must not be 5000 (fallback for unknown port)
    rdk = fv.get("route_distance_km", 0)
    check(rdk != 5000.0, "features",
          f"route_distance_km = {rdk:.0f} km (real Haversine, not fallback)",
          f"route_distance_km = 5000 — port coords lookup failed")

    info("features", f"Full feature vector: {json.dumps(fv, indent=2)}")


def test_score_endpoint():
    section("9 · /api/score ENDPOINT")

    code, result = get("/api/score/NX1048")
    ok = check(code == 200, "score", "GET /api/score/NX1048 → 200", f"HTTP {code}")
    if not ok:
        return

    score = result.get("score")
    factors = result.get("top_risk_factors", [])
    check(score is not None and 0 <= score <= 100, "score",
          f"score = {score} (valid 0–100)", f"Invalid score: {score}")
    check(len(factors) > 0, "score",
          f"{len(factors)} SHAP factors returned", "No SHAP factors in score response")

    info("score", f"Top factor: {factors[0].get('factor') if factors else 'none'}")


def test_analytics():
    section("10 · ANALYTICS ENDPOINT")

    code, data = get("/api/analytics")
    ok = check(code == 200, "analytics", "GET /api/analytics → 200", f"HTTP {code}")
    if not ok:
        return

    total    = data.get("total", 0)
    at_risk  = data.get("at_risk", 0)
    on_time  = data.get("on_time_pct", 0)
    rerouting = data.get("rerouting", 0)

    check(total >= 500, "analytics", f"total = {total} (≥500)", f"Only {total} shipments")
    check(0 < at_risk < total * 0.4, "analytics",
          f"at_risk = {at_risk} ({at_risk/total*100:.1f}%) — realistic",
          f"at_risk = {at_risk} ({at_risk/total*100:.1f}%) — unrealistic (was 69%)")

    # Cargo filter test — all types should return non-zero
    for cargo_key, label in [("pharma", "Pharma"), ("perishables", "Perishables"),
                               ("electronics", "Electronics"), ("machinery", "Machinery")]:
        c2, d2 = get(f"/api/analytics?cargo_type={cargo_key}")
        t2 = d2.get("total", 0)
        check(c2 == 200 and t2 > 0, "analytics",
              f"?cargo_type={cargo_key} → {t2} shipments",
              f"?cargo_type={cargo_key} → 0 shipments (filter broken)")

    info("analytics", f"Cargo breakdown: {data.get('cargo_breakdown', {})}")


def test_reroute(shipments: list[dict]):
    section("11 · REROUTE ENDPOINT")

    # Find a Dubai shipment
    dubai_ship = next(
        (s for s in shipments
         if "Dubai" in str(s.get("origin_port", ""))
         or "Dubai" in str(s.get("destination_port", ""))),
        None,
    )
    if dubai_ship:
        sid = dubai_ship["id"]
        code, routes = get(f"/api/shipments/{sid}/reroute")
        ok = check(code == 200, "reroute", f"Reroute for Dubai shipment {sid} → 200",
                   f"HTTP {code}")
        if ok:
            route_list = routes if isinstance(routes, list) else routes.get("reroute_options", [])
            check(len(route_list) > 0, "reroute",
                  f"{len(route_list)} real reroute options returned",
                  "0 routes — Dijkstra failing (probably port name mismatch)")
            if route_list:
                # Check no ALT HUB fallback in real reroutes
                ports_used = []
                for r in route_list:
                    ports_used.extend(r.get("path", []))
                has_alt_hub = "ALT HUB" in ports_used
                check(not has_alt_hub, "reroute",
                      "No 'ALT HUB' fallback in routes",
                      "ALT HUB fallback present — port name still broken")
    else:
        warn("reroute", "No Dubai shipment found to test — skipping Dubai reroute check")

    # Also test NX1048 (Tianjin → Long Beach)
    code2, r2 = get("/api/shipments/NX1048/reroute")
    ok2 = check(code2 == 200, "reroute", "GET /api/shipments/NX1048/reroute → 200",
                f"HTTP {code2}")
    if ok2:
        route_list2 = r2 if isinstance(r2, list) else r2.get("reroute_options", [])
        check(len(route_list2) >= 1, "reroute",
              f"NX1048 returned {len(route_list2)} reroute options",
              "NX1048 reroute returned 0 options")


def test_disruption_simulation(quick: bool):
    section("12 · DISRUPTION SIMULATION")

    if quick:
        info("disruption", "Skipped in --quick mode")
        return

    # Get scores before
    _, before_list = get("/api/shipments")
    before_scores = {
        s["id"]: float(s.get("risk_score", 0))
        for s in (before_list if isinstance(before_list, list) else [])
        if "Shanghai" in str(s.get("origin_port", ""))
        or "Shanghai" in str(s.get("destination_port", ""))
    }

    code, result = post("/api/simulate/disruption", {"port": "Shanghai", "severity": 7.0})
    ok = check(code == 200, "disruption", "POST /api/simulate/disruption → 200",
               f"HTTP {code}")
    if not ok:
        return

    n_affected = result.get("shipments_queued", 0)
    check(n_affected > 0, "disruption",
          f"{n_affected} shipments re-scored", "0 shipments affected — disruption has no effect")

    # Verify ML path was used (not arithmetic): scores should vary non-linearly
    rescored = result.get("rescored", [])
    if rescored and before_scores:
        deltas = []
        for r in rescored:
            sid = r.get("shipment_id")
            if sid in before_scores:
                delta = r.get("new_score", 0) - before_scores[sid]
                deltas.append(abs(delta))

        if deltas:
            delta_set = set(round(d, 1) for d in deltas)
            # Arithmetic bump with severity 7.0 would give +35 to every ship.
            # ML produces varying deltas.
            all_same = len(delta_set) == 1
            check(not all_same or len(deltas) == 1, "disruption",
                  f"Score deltas vary (ML inference confirmed): {sorted(delta_set)[:5]}",
                  f"All score deltas identical ({delta_set}) — arithmetic bump, not ML")

    # Check live_weather block (OWM integration)
    lw = result.get("live_weather")
    if lw:
        check("condition" in lw, "disruption",
              f"OWM live weather: {lw.get('condition')} ({lw.get('wind_speed_ms')} m/s wind)",
              "live_weather block malformed")
    else:
        warn("disruption", "No live_weather in response — OWM API key may not be set")

    info("disruption", f"Response: port={result.get('port')}, "
                        f"severity={result.get('severity')}, affected={n_affected}")


def test_model_info():
    section("13 · MODEL INFO & RETRAIN ENDPOINT")

    code, info_data = get("/api/model/info")
    ok = check(code == 200, "model", "GET /api/model/info → 200", f"HTTP {code}")
    if ok:
        auc = info_data.get("auc", 0)
        check(auc >= 0.80, "model", f"Model AUC = {auc:.4f} (≥0.80)", f"AUC = {auc} — low")
        check("trained_at" in info_data, "model",
              f"trained_at = {info_data.get('trained_at')}", "No trained_at timestamp")
        dr = info_data.get("disruption_rate_pct", 100)
        check(dr < 35, "model",
              f"Training disruption rate = {dr:.1f}% (realistic)",
              f"Training disruption rate = {dr:.1f}% — model trained on unrealistic data")
        info("model", f"n_estimators={info_data.get('n_estimators')}, "
                      f"features={info_data.get('feature_cols')}")


def test_websocket():
    section("14 · WEBSOCKET")
    # We can't easily test WebSocket from pure stdlib without websockets package
    # Confirm the WS upgrade endpoint exists via the /health that lists WS
    code, data = get("/health")
    if code == 200:
        info("ws", "WebSocket endpoint expected at ws://localhost:8000/ws — "
                    "verify manually in browser DevTools → Network → WS")
    else:
        warn("ws", "Backend not reachable — cannot verify WebSocket")


def test_rate_limiting():
    section("15 · RATE LIMITING")

    # Backend rate limit is 100 req/min per IP (RateLimitMiddleware in main.py).
    # Send 105 rapid requests — the 101st+ should return 429.
    info("rate_limit", "Sending 105 rapid requests to trigger 100 req/min limit…")
    codes = []
    for _ in range(105):
        c, _ = get("/health")   # use /health — lightest endpoint, no Redis
        codes.append(c)

    hit_429 = 429 in codes
    first_429 = codes.index(429) + 1 if hit_429 else None
    check(hit_429, "rate_limit",
          f"Rate limiter triggered 429 at request #{first_429} (limit=100/min)",
          "No 429 seen after 105 requests — RateLimitMiddleware may not be active")
    info("rate_limit", f"200s={codes.count(200)}, 429s={codes.count(429)}")


# ══════════════════════════════════════════════════════════════════════════════
#  MAIN
# ══════════════════════════════════════════════════════════════════════════════

def main():
    global BACKEND
    parser = argparse.ArgumentParser()
    parser.add_argument("--quick", action="store_true",
                        help="Skip slow tests (disruption simulation)")
    parser.add_argument("--backend-url", default=BACKEND,
                        help=f"Backend URL (default: {BACKEND})")
    args = parser.parse_args()

    BACKEND = args.backend_url

    print("\n" + "═"*60)
    print("  NexusFlow — Comprehensive Live Test Suite")
    print("═"*60)
    print(f"  Backend:  {BACKEND}")
    print(f"  Frontend: {FRONTEND}")
    print(f"  Mode:     {'quick' if args.quick else 'full'}")

    t0 = time.time()

    # Run all tests
    test_connectivity()
    shipments = test_shipment_list(args.quick)
    test_shap_population(shipments)
    test_ml_scores(shipments)
    test_cargo_data(shipments)
    test_port_data(shipments)
    test_individual_shipment()
    test_feature_vector()
    test_score_endpoint()
    test_analytics()
    test_reroute(shipments)
    test_disruption_simulation(args.quick)
    test_model_info()
    test_websocket()
    test_rate_limiting()

    elapsed = time.time() - t0

    # ── Summary ───────────────────────────────────────────────────────────────
    print("\n" + "═"*60)
    print("  SUMMARY")
    print("═"*60)

    passes   = [r for r in results if r[0] == PASS]
    failures = [r for r in results if r[0] == FAIL]
    warnings = [r for r in results if r[0] == WARN]

    if failures:
        print(f"\n  ❌ FAILURES ({len(failures)}):")
        for _, cat, msg in failures:
            print(f"     [{cat}] {msg}")

    if warnings:
        print(f"\n  ⚠️  WARNINGS ({len(warnings)}):")
        for _, cat, msg in warnings:
            print(f"     [{cat}] {msg}")

    print(f"\n  Results: {len(passes)} passed, {len(failures)} failed, "
          f"{len(warnings)} warnings  ({elapsed:.1f}s)")

    if failures:
        print("\n  ❌  Some tests FAILED — see above for details.")
        sys.exit(1)
    else:
        print("\n  ✅  All checks passed.")
        sys.exit(0)


if __name__ == "__main__":
    main()
