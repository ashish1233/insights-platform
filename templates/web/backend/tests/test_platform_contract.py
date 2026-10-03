"""The tests the platform expects every web app to keep passing.

Delete nothing here. Add your own tests alongside them.

These do not test the SDK — the platform team does that. They test that *this
app is still wired to it*, which is the thing a tenant can break. Both failures
below are silent in development and discovered in production otherwise.
"""

from __future__ import annotations

from fastapi.testclient import TestClient

from app.main import app


def test_health_answers_the_platform_contract():
    """ADR-3/ADR-4: operators run twenty-five apps through one view."""
    with TestClient(app) as client:
        response = client.get("/health")  # no credentials, on purpose
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert {"tenant_id", "tier", "sdk_version"} <= body.keys()


def test_unauthenticated_requests_are_refused():
    """ADR-3 gate 1. A 401 and not a 500 — the distinction matters to whoever
    is paged, and a 500 here would mean the gate failed rather than fired."""
    with TestClient(app) as client:
        response = client.get("/api/insights")
    assert response.status_code == 401
