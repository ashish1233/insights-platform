"""Stub analytical warehouse — plus one internal REST API on the same host.

Stands in for the two shared data connections the SDK ships (`data.py`):

- `WarehouseClient` POSTs to `/query` with a body whose `tenant_id` the SDK
  injects from config and the caller cannot reach.
- `RestClient` GETs `/rest/{resource}` with the tenant in the `X-Insights-Tenant`
  header, because an internal API owns its own filtering and the platform's job
  is to assert who is asking, not to rewrite someone else's contract.

An honest note about what this proves and what it does not. The tenant arrives as
a *claim from the caller* — a body field and a header. A caller that bypassed the
SDK could claim to be anyone. That is faithful to the real system only up to a
point: there, the connection's warehouse role and row-level security are the
backstop (ADR-2), and this stub has no equivalent. So this service demonstrates
the first half of the guarantee — that the SDK never sends anything but its own
tenant, and that the store filters on what it is sent — and the ADR is explicit
that the second half lives in the database grants, which ADR-5 flags as the
weakest unverified link.

Fixtures are invented. The compensation figures in particular are round, obviously
synthetic numbers chosen so nobody mistakes them for a real extract.
"""

from __future__ import annotations

from typing import Any

from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel, ConfigDict

SERVICE_NAME = "stub-warehouse"

app = FastAPI(
    title="Insights Platform — stub warehouse",
    description="Development stand-in for the shared warehouse and an internal REST API.",
    version="0.1.0",
)


# --------------------------------------------------------------------------
# Warehouse fixtures
#
# Shape is dataset -> tenant -> rows, rather than tenant -> dataset -> rows.
# That ordering is deliberate: it makes "this dataset exists but you have no rows
# in it" a representable state, which is the case the cross-tenant test turns on.
# --------------------------------------------------------------------------
_DATASETS: dict[str, dict[str, list[dict[str, Any]]]] = {
    "compensation": {
        "people-analytics": [
            {
                "employee_id": "EMP-1001",
                "department": "Engineering",
                "level": "L4",
                "base_salary": 100000,
                "bonus_target_pct": 10,
                "currency": "USD",
                "effective_year": 2026,
            },
            {
                "employee_id": "EMP-1002",
                "department": "Engineering",
                "level": "L5",
                "base_salary": 130000,
                "bonus_target_pct": 15,
                "currency": "USD",
                "effective_year": 2026,
            },
            {
                "employee_id": "EMP-1003",
                "department": "Sales",
                "level": "L3",
                "base_salary": 80000,
                "bonus_target_pct": 20,
                "currency": "USD",
                "effective_year": 2026,
            },
            {
                "employee_id": "EMP-1004",
                "department": "Sales",
                "level": "L4",
                "base_salary": 95000,
                "bonus_target_pct": 20,
                "currency": "USD",
                "effective_year": 2026,
            },
            {
                "employee_id": "EMP-1005",
                "department": "Operations",
                "level": "L2",
                "base_salary": 60000,
                "bonus_target_pct": 5,
                "currency": "USD",
                "effective_year": 2026,
            },
            {
                "employee_id": "EMP-1006",
                "department": "Operations",
                "level": "L3",
                "base_salary": 75000,
                "bonus_target_pct": 5,
                "currency": "USD",
                "effective_year": 2025,
            },
        ],
        # `finance` is intentionally absent rather than empty. The lookup below
        # returns [] for a tenant with no slice, which is the behaviour under test:
        # a known dataset must never fall through to another tenant's rows.
    },
    "spend": {
        "finance": [
            {
                "cost_center": "CC-100",
                "category": "Cloud Infrastructure",
                "quarter": "2026-Q1",
                "amount": 250000,
                "currency": "USD",
            },
            {
                "cost_center": "CC-100",
                "category": "Cloud Infrastructure",
                "quarter": "2026-Q2",
                "amount": 275000,
                "currency": "USD",
            },
            {
                "cost_center": "CC-200",
                "category": "Software Licences",
                "quarter": "2026-Q1",
                "amount": 90000,
                "currency": "USD",
            },
            {
                "cost_center": "CC-200",
                "category": "Software Licences",
                "quarter": "2026-Q2",
                "amount": 90000,
                "currency": "USD",
            },
            {
                "cost_center": "CC-300",
                "category": "Travel",
                "quarter": "2026-Q1",
                "amount": 45000,
                "currency": "USD",
            },
            {
                "cost_center": "CC-300",
                "category": "Travel",
                "quarter": "2026-Q2",
                "amount": 52000,
                "currency": "USD",
            },
        ],
        "people-analytics": [],
    },
}


# --------------------------------------------------------------------------
# Internal REST API fixtures — resource -> tenant -> object
# --------------------------------------------------------------------------
_REST_RESOURCES: dict[str, dict[str, dict[str, Any]]] = {
    # Same resource name, different content per tenant: the point of the header.
    "org-summary": {
        "people-analytics": {
            "headcount": 6,
            "departments": ["Engineering", "Sales", "Operations"],
            "review_cycle": "2026-H1",
        },
        "finance": {
            "headcount": 3,
            "departments": ["Financial Planning"],
            "close_period": "2026-Q2",
        },
    },
    "budget-cycle": {
        "finance": {
            "cycle": "2026",
            "status": "open",
            "approved_total": 802000,
            "currency": "USD",
        },
    },
}

# Reserved query keys that shape the response rather than filter rows.
_RESERVED_PARAMS = {"tenant_id", "dataset", "limit"}


class QueryRequest(BaseModel):
    # The SDK splats arbitrary `**params` into this body. Rejecting unknown keys
    # would make every new caller-side filter a breaking change in the stub.
    model_config = ConfigDict(extra="allow")

    tenant_id: str
    dataset: str


@app.post("/query")
async def query(request: QueryRequest) -> dict[str, Any]:
    """Return rows for one tenant's slice of one dataset.

    Order of operations is the whole contract: the tenant slice is selected
    first, and any caller-supplied filter narrows what is already inside it.
    There is no code path that widens the slice.
    """
    by_tenant = _DATASETS.get(request.dataset)
    if by_tenant is None:
        # Dataset names are platform metadata, not tenant data, so a 404 here
        # leaks nothing a tenant could not read from the catalogue anyway.
        raise HTTPException(
            status_code=404, detail=f"Unknown dataset {request.dataset!r}."
        )

    rows = by_tenant.get(request.tenant_id, [])

    params = request.model_extra or {}
    filters = {k: v for k, v in params.items() if k not in _RESERVED_PARAMS}
    for column, value in filters.items():
        # Compared as strings so that `quarter=2026-Q1` and `effective_year=2026`
        # both work regardless of how the caller serialised them.
        rows = [row for row in rows if str(row.get(column)) == str(value)]

    limit = params.get("limit")
    if limit is not None:
        try:
            rows = rows[: int(limit)]
        except (TypeError, ValueError):
            raise HTTPException(status_code=400, detail="limit must be an integer.")

    return {"rows": rows}


@app.get("/rest/{resource}")
async def rest(
    resource: str,
    x_insights_tenant: str | None = Header(default=None),
) -> dict[str, Any]:
    """An internal REST API registered as a shared data connection.

    The tenant is required, not optional. An upstream that answers an
    un-attributed request is one that will eventually answer the wrong one.
    """
    if not x_insights_tenant:
        raise HTTPException(
            status_code=400,
            detail="X-Insights-Tenant header is required.",
        )

    by_tenant = _REST_RESOURCES.get(resource)
    if by_tenant is None:
        raise HTTPException(status_code=404, detail=f"Unknown resource {resource!r}.")

    return {
        "resource": resource,
        "tenant_id": x_insights_tenant,
        # Empty rather than 404 when the tenant has no entry, for the same reason
        # as /query: a tenant asking about a resource it has no slice of gets
        # nothing, not somebody else's object.
        "data": by_tenant.get(x_insights_tenant, {}),
    }


@app.get("/health")
async def health() -> dict[str, Any]:
    return {
        "status": "ok",
        "service": SERVICE_NAME,
        "datasets": sorted(_DATASETS),
        "rest_resources": sorted(_REST_RESOURCES),
    }
