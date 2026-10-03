# Stub audit sink

Append-only audit store. Port **8083**.

ADR-4 turns on one structural claim: this store is **outside the platform team's
control**, operated by a different group — security or IT — precisely so that the
people whose access is being recorded are not the people who administer the
recording. An audit log the audited party can edit is theatre, and a compliance
partner will identify it as theatre in one question.

That is why this is a separate service with its own deployment rather than a table
in the platform's database, and it is why the API is deliberately incomplete.

## Endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/events` | append one event → `201 {"recorded": true, "seq": n}` |
| `GET` | `/events` | read, newest first → `{"events": [...], "count", "total_matching"}` |
| `GET` | `/health` | status and event count |

`GET /events` takes `tenant_id`, `action`, and `limit` (default 200, max 10 000).
`tenant_id` is the tenant-scoped read — the standing read ADR-4 grants a tenant's
compliance partner on their own slice, without going through the platform team.
Omitted, it is the platform operator view, which ADR-4 permits across tenants
because an audit event records the *fact* of an access and never its contents.

## No mutating verbs

There is no `DELETE`, no `PUT`, no `PATCH`, no truncate. Not disabled by
configuration — **absent from the code**, because configuration is administered by
somebody, and the whole point of ADR-4 is that the somebody is not us. FastAPI
answers `405` for the verbs that do not exist, which is the right answer: not
"forbidden for you", but "this store does not do that for anyone".

## Event shape

The wire contract is `insights_platform.audit.AuditEvent`: `tenant_id`,
`principal`, `action`, `resource`, `result`, `ts`. The sink mirrors it as a
pydantic model and compares the two field sets **at import**, so if the SDK adds a
field this service fails to boot rather than silently dropping it — the failure
mode that would otherwise only surface during an audit.

Reads add two fields the store owns and the caller cannot set:

- `seq` — monotonic arrival order. "Newest first" is defined by this, not by `ts`.
- `received_at` — when this store saw the event.

`ts` comes from the machine that emitted the event, so it can be skewed, repeated,
or wrong. `seq` is the store's own record and is the one to trust for ordering.

## Why `POST` happens before the access, not after

The SDK records the audit event *before* it fetches (`data.py`). On the restricted
tier a failed audit write has to prevent the disclosure, and an audit written
afterwards cannot do that. So a non-2xx from this endpoint is what makes the
restricted tier fail closed, and the endpoint has exactly one job with no optional
behaviour: no deduplication, no validation of the principal, no rewriting. A sink
that can reject an event for a judgement call is a sink that can be argued into
dropping one.

## Stub limits

Storage is a Python list, which is honest about what this is. The real store is
durable and write-once (object-lock or equivalent), has a retention policy set by
the operating team, and survives restarts. This one runs single-worker on purpose:
the store is per-process, so a second worker would silently split the audit trail
in half.

## Run it

```bash
uv venv && uv pip install -e .
uv run uvicorn auditlog_stub:app --port 8083 --reload
```

With plain pip, install the SDK first (`pip install -e ../../../insights-sdk-python`),
then `pip install -e .`.

```bash
curl -s localhost:8083/events -H 'content-type: application/json' \
  -d '{"tenant_id":"people-analytics","principal":"user:alice@example.com",
       "action":"warehouse.read","resource":"compensation","result":"ok","ts":1767225600.0}'

curl -s 'localhost:8083/events?tenant_id=people-analytics'

# every mutating verb is absent, not disabled
curl -s -o /dev/null -w '%{http_code}\n' -X DELETE localhost:8083/events
```
