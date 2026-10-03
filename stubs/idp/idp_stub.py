"""Stub identity provider — stands in for corporate SSO.

This service exists so that nothing else in the platform has to mint credentials.
`identity.py` is explicit about the split: the SDK only *verifies* tokens, because
a tenant app that can issue them can impersonate any principal in its own tenant,
and the audit trail ADR-4 depends on would be worthless.

Signing is delegated to `insights_platform.identity.issue_token` rather than
re-implemented here. If the SDK changes the claim set or the algorithm, this stub
follows automatically instead of drifting into a token the SDK rejects.

What a real IdP would do differently, and why it does not matter for a stub:

- **User scopes would come from the platform's grant records**, not from the request
  body. Here the caller names the scopes it wants, which makes this service a
  convenience, not a security control — it exists to make the *app's* enforcement
  demonstrable (ask for fewer scopes, watch the app return 403).
- **Service identities would be registered**, and an unregistered one would be
  refused. See `_scopes_for_service` for the stub's fallback behaviour.
"""

from __future__ import annotations

import os

from fastapi import FastAPI
from pydantic import BaseModel, Field

from insights_platform.authz import READ_INSIGHTS, READ_SENSITIVE, RUN_EXPORT
from fastapi.middleware.cors import CORSMiddleware

from insights_platform.identity import (
    SERVICE_TOKEN_TTL_SECONDS,
    USER_TOKEN_TTL_SECONDS,
    PrincipalKind,
    issue_token,
)

SERVICE_NAME = "stub-idp"

app = FastAPI(
    title="Insights Platform — stub IdP",
    description="Development stand-in for corporate SSO. Not for production use.",
    version="0.1.0",
)

# Tenant frontends call this directly to sign in, from a different origin than
# the one it is served on. Real corporate SSO is a redirect flow and needs none
# of this; it exists only because the stub is called as an API.
#
# The list is explicit rather than a wildcard, and that is the point: a new
# frontend origin is a thing the platform grants, not something a team can
# assume. 5100 is the Insights Hub shell, 5174 a standard-tier app running
# standalone, 5173 the restricted-tier dashboard — which keeps its own origin
# precisely so that the shell cannot mount it (ADR-2).
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5100",
        "http://127.0.0.1:5100",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type"],
)


# --------------------------------------------------------------------------
# Service scope registry
#
# A real IdP resolves this from a directory entry created when the job is
# onboarded: the job's service account is a directory principal, and its scopes
# are an attribute of that principal, maintained by whoever approves the
# onboarding. Keeping the map in code here is the whole point of a stub — the
# shape of the lookup is what matters to the rest of the platform, not where the
# answer is stored.
#
# Keyed by (tenant_id, service) because the same job name in two tenants is two
# different principals with two different approvals behind them.
# --------------------------------------------------------------------------
_SERVICE_SCOPES: dict[tuple[str, str], frozenset[str]] = {
    # The finance nightly export reads its own spend data and writes a file.
    ("finance", "spend-export"): frozenset({READ_INSIGHTS, RUN_EXPORT}),
    # Compensation is restricted-tier data, so the sensitive scope is granted
    # explicitly rather than inherited from the ordinary read scope.
    ("people-analytics", "compensation-refresh"): frozenset(
        {READ_INSIGHTS, READ_SENSITIVE}
    ),
}

# Fallback for a service name this stub has not seen. A real IdP returns 401 for
# an unregistered principal; refusing here would make the stub unusable while the
# example apps are still choosing their job names, so instead we grant the
# narrowest plausible set and say so in the response.
_DEFAULT_SERVICE_SCOPES = frozenset({READ_INSIGHTS})

# Name-shaped guesses applied before the default. Deliberately narrow: a job
# called "...-export" plainly needs to run an export, and inferring that is less
# surprising than handing it a token the app will reject with a 403 that points
# at the wrong layer.
_SERVICE_NAME_HINTS: tuple[tuple[str, frozenset[str]], ...] = (
    ("export", frozenset({READ_INSIGHTS, RUN_EXPORT})),
)


def _scopes_for_service(tenant_id: str, service: str) -> tuple[frozenset[str], str]:
    """Resolve a service principal's scopes. Returns (scopes, how_it_was_resolved)."""
    exact = _SERVICE_SCOPES.get((tenant_id, service))
    if exact is not None:
        return exact, "registered"

    lowered = service.lower()
    for fragment, scopes in _SERVICE_NAME_HINTS:
        if fragment in lowered:
            return scopes, "inferred-from-name"

    return _DEFAULT_SERVICE_SCOPES, "default"


class UserTokenRequest(BaseModel):
    tenant_id: str
    subject: str
    scopes: list[str] = Field(default_factory=list)


class ServiceTokenRequest(BaseModel):
    tenant_id: str
    service: str


@app.post("/token/user")
async def mint_user_token(request: UserTokenRequest) -> dict[str, object]:
    """Mint a token for a human, authenticated through SSO.

    `scopes` is taken at face value — see the module docstring. The claim that
    matters and is *not* negotiable is `kind`: a user token is always
    PrincipalKind.USER, so `require_human` in the SDK can tell a person from a
    job no matter what the caller asks for.
    """
    token = issue_token(
        kind=PrincipalKind.USER,
        subject=request.subject,
        tenant_id=request.tenant_id,
        scopes=frozenset(request.scopes),
    )
    return {
        "token": token,
        "token_type": "Bearer",
        "expires_in": USER_TOKEN_TTL_SECONDS,
    }


@app.post("/token/service")
async def mint_service_token(request: ServiceTokenRequest) -> dict[str, object]:
    """Mint a token for a scheduled job.

    PrincipalKind.SERVICE, never USER. Attributing a 3 a.m. batch run to a human
    subject would put a false statement into the audit store, which is the one
    place in this system that has to be literally true (ADR-4).

    Unlike the user endpoint, scopes are not caller-supplied: the job names
    itself and the platform decides what that name may do.
    """
    scopes, resolution = _scopes_for_service(request.tenant_id, request.service)
    token = issue_token(
        kind=PrincipalKind.SERVICE,
        subject=request.service,
        tenant_id=request.tenant_id,
        scopes=scopes,
    )
    return {
        "token": token,
        "token_type": "Bearer",
        "expires_in": SERVICE_TOKEN_TTL_SECONDS,
        # Echoed so an operator debugging a 403 can see which scopes were granted
        # and whether the service was actually registered, without decoding the JWT.
        "granted_scopes": sorted(scopes),
        "scope_resolution": resolution,
    }


@app.get("/health")
async def health() -> dict[str, object]:
    return {
        "status": "ok",
        "service": SERVICE_NAME,
        "registered_services": len(_SERVICE_SCOPES),
        # Surfaced because every service in the compose stack must agree on this
        # secret; a mismatch shows up as "Token is not valid: Signature verification
        # failed" in an app, which does not point at the real cause.
        "signing_secret_overridden": "INSIGHTS_TOKEN_SECRET" in os.environ,
    }
