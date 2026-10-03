"""Interactive web app — the scaffold a team copies and then owns.

Day one for a tenant is: change the TODOs below, point them at your dataset and
your scope, and delete this docstring. Everything else — authentication, tenant
tagging, scoped data access, audit, the health contract — arrives through
`install()` and is not yours to maintain (ADR-1: shared behaviour reaches apps as
a versioned library, not as a service on your request path).

What you are *not* expected to do here:

- Write authentication. ADR-3 gate 1 is installed by the SDK; a request without a
  valid bearer token never reaches your route.
- Tag your logs. ADR-3 gate 2 binds tenant and principal for the request; the SDK
  logger refuses anything that looks like a payload (ADR-4).
- Filter by tenant in your query. ADR-3 gate 3 injects the tenant scope inside
  the data client. There is deliberately no parameter through which to ask for
  another tenant's rows.
"""

from __future__ import annotations

from typing import Any

from fastapi import FastAPI
from insights_platform import (
    READ_INSIGHTS,
    Principal,
    current_principal,
    install,
    load_config,
    require_scope,
    scoped,
)
from insights_platform.middleware import Depends

# TODO(team): the warehouse dataset this app reads. Ask your data owner for the
# name; the platform team grants your tenant's warehouse role access to it
# (ADR-2 — that grant is the backstop underneath the SDK's scoping).
DATASET = "TODO_your_dataset"

# TODO(team): the scope a caller must hold. `READ_INSIGHTS` ("insights:read") is
# the ordinary-reporting scope and the right default. If your dataset is
# sensitive enough that disclosure cannot be walked back, you are probably a
# restricted-tier tenant and want `READ_SENSITIVE` — talk to the platform team,
# because tier is assigned, not self-selected (ADR-2).
REQUIRED_SCOPE = READ_INSIGHTS

# Tier comes from the environment the platform controls, never from this file.
config = load_config()

app = FastAPI(title="TODO(team): your app name", version="0.1.0")

# One call. This is the whole platform integration (ADR-1).
platform = install(app, config)


@app.get("/api/insights")
@scoped(REQUIRED_SCOPE)
async def read_insights(
    principal: Principal = Depends(current_principal),
) -> dict[str, Any]:
    """Return rows from the warehouse for the authenticated caller.

    TODO(team): replace this with your own route(s). Keep the two platform calls.

    `@scoped(...)` and `require_scope(...)` are not redundant, and it is worth
    knowing why before you delete one of them:

    - The decorator is a *declaration*, read at startup. On the restricted tier
      the app refuses to boot if any route lacks one (ADR-2, applied at boot
      where it is cheap to notice rather than at request time).
    - `require_scope` is the *check*, and it runs per request. Declaring a scope
      does not enforce it.

    Call `require_scope` before fetching, not after: the data client audits the
    read before it performs it (ADR-2 fail-closed ordering), and recording an
    access you are about to refuse would put a false entry in the trail ADR-4
    depends on.
    """
    require_scope(principal, REQUIRED_SCOPE)
    rows = await platform.warehouse.fetch(principal, DATASET)
    return {"rows": rows}
