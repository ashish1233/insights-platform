# Stub warehouse

Development stand-in for the shared analytical warehouse **and** one internal REST
API, served by the same process. Port **8082**.

Both of the SDK's data connections point here (`data.py`): `WarehouseClient` at
`/query`, `RestClient` at `/rest/{resource}`. They differ in how the tenant
travels — a body field for the warehouse, an `X-Insights-Tenant` header for the
REST API — because an internal API owns its own filtering and the platform's job
is to assert who is asking, not to rewrite someone else's contract.

## Endpoints

| Method | Path | Tenant arrives as | Returns |
| --- | --- | --- | --- |
| `POST` | `/query` | `tenant_id` in the JSON body | `{"rows": [...]}` |
| `GET` | `/rest/{resource}` | `X-Insights-Tenant` header | `{"resource", "tenant_id", "data"}` |
| `GET` | `/health` | — | status plus the dataset and resource names it holds |

`/query` accepts arbitrary extra body keys because the SDK splats `**params` into
the request. Any key matching a column filters rows by equality; `limit` truncates.

## Tenant behaviour

| Request | Response |
| --- | --- |
| Known dataset, tenant has rows | `200`, that tenant's rows |
| Known dataset, tenant has no slice | `200`, `{"rows": []}` |
| Unknown dataset | `404` |
| Any request | never another tenant's rows |

The tenant slice is selected first and caller-supplied filters only narrow what is
already inside it. There is no code path that widens the slice.

## Fixtures

Invented, and the compensation figures are round synthetic numbers chosen so
nobody mistakes them for a real extract.

| Dataset | `people-analytics` | `finance` |
| --- | --- | --- |
| `compensation` | 6 rows | no slice → `[]` |
| `spend` | no rows → `[]` | 6 rows |

| REST resource | `people-analytics` | `finance` |
| --- | --- | --- |
| `org-summary` | headcount, departments, review cycle | headcount, departments, close period |
| `budget-cycle` | no entry → `{}` | cycle, status, approved total |

## What this does and does not prove

The tenant arrives as a *claim from the caller* — a body field and a header — so a
caller that bypassed the SDK could claim to be anyone. That is faithful to the real
system only up to a point. There, the connection's warehouse role and row-level
security are the backstop (ADR-2), and this stub has no equivalent.

So this service demonstrates the half of the guarantee that lives in code: the SDK
never sends anything but its own tenant, and the store filters on what it is sent.
The other half lives in database grants, which ADR-5 names as the weakest
unverified link in the design. Worth saying out loud rather than letting a green
test suite imply otherwise.

## Run it

```bash
uv venv && uv pip install -e .
uv run uvicorn warehouse_stub:app --port 8082 --reload
```

With plain pip, install the SDK first (`pip install -e ../../../insights-sdk-python`),
then `pip install -e .`.

```bash
curl -s localhost:8082/health

# people-analytics gets its compensation rows
curl -s localhost:8082/query -H 'content-type: application/json' \
  -d '{"tenant_id":"people-analytics","dataset":"compensation"}'

# finance asking the same dataset gets nothing, not someone else's rows
curl -s localhost:8082/query -H 'content-type: application/json' \
  -d '{"tenant_id":"finance","dataset":"compensation"}'

# unknown dataset
curl -s -o /dev/null -w '%{http_code}\n' localhost:8082/query \
  -H 'content-type: application/json' \
  -d '{"tenant_id":"finance","dataset":"nope"}'

# the REST connection, scoped by header
curl -s localhost:8082/rest/org-summary -H 'X-Insights-Tenant: finance'
```
