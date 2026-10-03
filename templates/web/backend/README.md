# Web app template (backend)

The scaffold for an interactive insight app. Copy this directory into your own
repository, work through the `TODO(team)` markers, and delete this heading.

This is a **paved road, not a framework**. After you copy it, you own it. The
platform team owns the SDK underneath it and will open pull requests against
your repository when it changes (ADR-1) — merge them.

## Day one

```bash
cp -r templates/web/backend ../your-app && cd ../your-app
cp .env.example .env            # then edit INSIGHTS_TENANT_ID

python -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"
pre-commit install

uvicorn app.main:app --reload --port 8000
curl localhost:8000/health
```

Then change three things in `src/app/main.py`:

| Marker | What to put there |
| --- | --- |
| `DATASET` | the warehouse dataset you read |
| `REQUIRED_SCOPE` | the scope a caller must hold |
| route body | your query and response shape |

That is the whole integration. If you find yourself writing authentication,
log tagging, or a `WHERE tenant_id = ...`, stop — the SDK already did it, and
re-implementing it is how the two versions drift apart.

## What you get, and where it is decided

| Behaviour | Comes from | Why it is not yours |
| --- | --- | --- |
| Authentication on every route | `install()` | ADR-3 gate 1. No identity, no request. |
| `tenant_id` + principal on every log line | `install()` | ADR-3 gate 2 — ADR-4's operator view is built on it. |
| Tenant scoping on every query | `platform.warehouse` | ADR-3 gate 3. There is no parameter through which to ask for another tenant's rows. |
| Audit record per data access | the data client | ADR-4. Written *before* the fetch, so a failed write can prevent the disclosure. |
| `GET /health` in the standard shape | `install()` | ADR-3/ADR-4. Do not shadow it. |
| 401/403/502/503 translation | `install()` | A plain exception inside Starlette middleware surfaces as a 500; the SDK translates in the one layer that knows about HTTP. |

## Two things that look redundant and are not

**`@scoped(...)` and `require_scope(...)`.** The decorator *declares* what a
route needs and is read once at startup; on the restricted tier an app with an
undeclared route refuses to boot (ADR-2). `require_scope` is the *check*, and it
runs per request. Declaring without checking serves your data to every
authenticated caller, so write both.

**The tier in `.env` and the tier in production.** Tier is assigned by the
platform team, not chosen (ADR-2, ADR-5 item 7). Setting `INSIGHTS_TIER=restricted`
locally makes your own app stricter with itself; it does not give you
restricted-tier warehouse grants or the fail-closed audit path.

## Telemetry will refuse things you want to log

`log.info("rows", rows=rows)` raises. That is ADR-4's main control, and it is
aimed at exactly this line — the realistic way sensitive data reaches an
operator's screen is a well-meant log statement in an exception handler, not a
malicious query. Log `row_count=len(rows)` instead. To share real data with the
platform team, generate a scrubbed sample and hand it over deliberately.

## Checks that run before you commit

`.pre-commit-config.yaml` carries two rules that ADR-3 places in CI because
their failure cannot be walked back:

- **Secret scanning** — a credential in git history is not removable in
  practice; it has to be rotated, and rotation is manual today (ADR-5).
- **Health-contract conformance** (`scripts/check_health_contract.py`) — runs
  offline, imports your app, starts it, and asserts `/health`. It also catches a
  restricted-tier app that would fail to start.

`--no-verify` still works and is not being removed. A team mid-incident needs an
escape hatch; the bypass is recorded, and that record is the control.

## Deployment

The `Dockerfile` runs as a non-root user (uid 10001) on port 8000 and declares a
`HEALTHCHECK` against the platform health endpoint. Configuration arrives as
environment variables; the container writes nothing to disk.

There is no staging environment (ADR-5 item 4). Local development and production
are what exist. Upgrade pull requests arrive with the migration already applied,
but **you merge them** — test however you normally would, because the platform
team can confirm the SDK still works and cannot confirm your numbers are still
right.
