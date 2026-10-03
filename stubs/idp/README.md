# Stub IdP

Development stand-in for corporate SSO. Port **8081**.

Issuing tokens is deliberately *not* the SDK's job (`identity.py`): the SDK only
verifies. A tenant app that could mint credentials could impersonate any principal
in its own tenant, which would make the audit trail ADR-4 depends on unfalsifiable.
This service is where that capability lives instead.

It signs with `insights_platform.identity.issue_token` rather than re-implementing
JWT encoding, so the claim set and algorithm cannot drift from what `verify_token`
expects.

## Endpoints

| Method | Path | Body / params | Returns |
| --- | --- | --- | --- |
| `POST` | `/token/user` | `{"tenant_id": str, "subject": str, "scopes": [str]}` | `{"token", "token_type", "expires_in"}` |
| `POST` | `/token/service` | `{"tenant_id": str, "service": str}` | `{"token", "token_type", "expires_in", "granted_scopes", "scope_resolution"}` |
| `GET` | `/health` | — | `{"status", "service", "registered_services", "signing_secret_overridden"}` |

User tokens are `PrincipalKind.USER` and live one hour. Service tokens are
`PrincipalKind.SERVICE` and live fifteen minutes — ADR-1 has no revocation path,
so lifetime is the only control, and an unattended job holding a credential open
for longer should be re-authenticating.

## Scopes

**User tokens take the scopes the caller asks for.** This is a stub convenience,
not a security control. It exists so an app's own enforcement is demonstrable:
request a token without `insights:read_sensitive`, call a route that requires it,
get a 403 from the app. A real deployment resolves identity from corporate SSO and
scopes from the platform's own grant records (ADR-2)
and ignores what the client would prefer.

**Service tokens do not.** The job names itself; the platform decides what that
name may do. The map lives in `_SERVICE_SCOPES` in `idp_stub.py` — a real IdP
reads it from a directory entry maintained by whoever approved the job's
onboarding. Registered today:

| Tenant | Service | Scopes |
| --- | --- | --- |
| `finance` | `spend-export` | `insights:read`, `export:run` |
| `people-analytics` | `compensation-refresh` | `insights:read`, `insights:read_sensitive` |

An unregistered service name gets `insights:read`, or `insights:read` +
`export:run` if the name contains `export`. A real IdP would refuse it outright;
the fallback exists so the stub stays usable while example apps are still choosing
their job names. The response's `scope_resolution` field says which path was taken,
so a surprising 403 is traceable without decoding the JWT.

## Signing secret

Every service in the stack must share `INSIGHTS_TOKEN_SECRET`. A mismatch surfaces
inside an app as `Token is not valid: Signature verification failed`, which does
not point at the real cause — `GET /health` reports whether the variable was set,
so you can compare across containers.

## Run it

```bash
uv venv && uv pip install -e .
uv run uvicorn idp_stub:app --port 8081 --reload
```

With plain pip, install the SDK first (`pip install -e ../../../insights-sdk-python`),
then `pip install -e .`.

```bash
curl -s localhost:8081/health
curl -s localhost:8081/token/user -H 'content-type: application/json' \
  -d '{"tenant_id":"people-analytics","subject":"alice@example.com","scopes":["insights:read","insights:read_sensitive"]}'
curl -s localhost:8081/token/service -H 'content-type: application/json' \
  -d '{"tenant_id":"finance","service":"spend-export"}'
```
