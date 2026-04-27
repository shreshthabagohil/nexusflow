"""
Unit tests for RouteOptimizer.

Uses the hardcoded fallback graph (no shipping_graph.json needed).
Tests find_reroutes() output shape, validity, and blocked-port behaviour.
"""

from __future__ import annotations

import pytest

from app.services.route_optimizer import RouteOptimizer


@pytest.fixture(scope="module")
def optimizer() -> RouteOptimizer:
    return RouteOptimizer()


class TestRouteOptimizerFallback:
    def test_find_reroutes_returns_list(self, optimizer):
        routes = optimizer.find_reroutes("Singapore", "Rotterdam")
        assert isinstance(routes, list)

    def test_find_reroutes_returns_up_to_3(self, optimizer):
        routes = optimizer.find_reroutes("Singapore", "Rotterdam")
        assert 1 <= len(routes) <= 3

    def test_each_route_has_required_keys(self, optimizer):
        routes = optimizer.find_reroutes("Singapore", "Rotterdam")
        required = {"route_id", "description", "estimated_time_hours", "cost_delta_usd", "risk_reduction"}
        for route in routes:
            assert required.issubset(route.keys()), f"Missing keys: {required - route.keys()}"

    def test_estimated_time_positive(self, optimizer):
        routes = optimizer.find_reroutes("Singapore", "Rotterdam")
        for r in routes:
            assert r["estimated_time_hours"] > 0

    def test_risk_reduction_is_positive_number(self, optimizer):
        # risk_reduction is expressed as percentage points (e.g. 15–45)
        routes = optimizer.find_reroutes("Singapore", "Rotterdam")
        for r in routes:
            assert isinstance(r["risk_reduction"], (int, float))
            assert r["risk_reduction"] > 0

    def test_blocked_node_excluded_from_routes(self, optimizer):
        # Parameter is blocked_node (not blocked_port)
        routes = optimizer.find_reroutes("Shanghai", "Rotterdam", blocked_node="Dubai (Jebel Ali)")
        for r in routes:
            assert "Dubai (Jebel Ali)" not in r["description"]

    def test_unknown_ports_return_empty_or_fallback(self, optimizer):
        # Should not crash — either returns [] or fallback routes
        result = optimizer.find_reroutes("Atlantis", "Narnia")
        assert isinstance(result, list)

    def test_same_origin_destination(self, optimizer):
        result = optimizer.find_reroutes("Singapore", "Singapore")
        assert isinstance(result, list)

    def test_route_ids_are_unique(self, optimizer):
        routes = optimizer.find_reroutes("Singapore", "Rotterdam")
        ids = [r["route_id"] for r in routes]
        assert len(ids) == len(set(ids))
