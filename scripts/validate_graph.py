#!/usr/bin/env python3
"""Validate data/shipping_graph.json against structural requirements."""

import json
import sys
from pathlib import Path

GRAPH_PATH = Path(__file__).parent.parent / "data" / "shipping_graph.json"

errors = []


def check(label, passed, detail=""):
    status = "PASS" if passed else "FAIL"
    msg = f"[{status}] {label}"
    if not passed and detail:
        msg += f": {detail}"
    print(msg)
    if not passed:
        errors.append(label)


def main():
    try:
        with open(GRAPH_PATH) as f:
            graph = json.load(f)
    except FileNotFoundError:
        print(f"ERROR: {GRAPH_PATH} not found")
        sys.exit(1)
    except json.JSONDecodeError as e:
        print(f"ERROR: Invalid JSON — {e}")
        sys.exit(1)

    nodes = graph.get("nodes", [])
    edges = graph.get("edges", [])

    node_ids = {n["id"] for n in nodes}

    # Check 1: node and edge counts
    check(
        "Graph has exactly 200 nodes",
        len(nodes) == 200,
        f"found {len(nodes)}",
    )
    check(
        "Graph has at least 300 edges",
        len(edges) >= 300,
        f"found {len(edges)}",
    )

    # Check 2: every node appears in at least 2 edges (no orphans)
    from collections import defaultdict
    degree = defaultdict(int)
    for edge in edges:
        degree[edge.get("source")] += 1
        degree[edge.get("target")] += 1

    orphans = [nid for nid in node_ids if degree[nid] < 2]
    check(
        "Every node appears in at least 2 edges",
        len(orphans) == 0,
        f"{len(orphans)} orphan node(s): {orphans[:5]}{'...' if len(orphans) > 5 else ''}",
    )

    # Check 3: no negative numeric fields on edges
    bad_edges = []
    for i, edge in enumerate(edges):
        for field in ("distance_km", "transit_hours", "cost_usd"):
            val = edge.get(field)
            if val is not None and val < 0:
                bad_edges.append((i, field, val))
    check(
        "No edge has negative distance_km, transit_hours, or cost_usd",
        len(bad_edges) == 0,
        f"{len(bad_edges)} violation(s): {bad_edges[:3]}",
    )

    # Check 4: source and target of every edge exist as node IDs
    missing = []
    for i, edge in enumerate(edges):
        for key in ("source", "target"):
            nid = edge.get(key)
            if nid not in node_ids:
                missing.append((i, key, nid))
    check(
        "Source and target of every edge exist as node IDs",
        len(missing) == 0,
        f"{len(missing)} reference(s) to unknown nodes: {missing[:3]}",
    )

    print()
    if errors:
        print("Graph validation FAILED — see errors above")
        sys.exit(1)
    else:
        print("Graph validation PASSED")
        sys.exit(0)


if __name__ == "__main__":
    main()
