# Scheduled job template

The scaffold for a batch job. Copy this directory into your own repository, work
through the `TODO(team)` markers, and delete this heading.

There are two templates rather than one because web apps and batch jobs share
almost nothing (ADR-1): different runtime model, different identity, different
signals, different deployment. A single template would make half of your first
day deleting the parts that do not apply.

## Day one

```bash
cp -r templates/job ../your-job && cd ../your-job
cp .env.example .env            # then edit INSIGHTS_TENANT_ID

python -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"
pre-commit install

python -m job.main              # needs the local stubs running
```

Then change three things in `src/job/main.py`: `JOB_NAME`, `DATASET`, and the
`body()` function. That is the whole integration.

## The one thing not to work around

**A job runs as a service identity, never as a user.** `run_job()` exchanges
your deploy-time credential for a short-lived service token and hands `body()` a
service principal.

The shortcut everyone reaches for is to mint a user token for a "service
account" person — it makes scope grants simpler and it works immediately. It
also makes every audit record this job writes a false statement: an auditor
reading *"alice@ read the compensation dataset at 03:00"* has no way to know
alice was asleep. ADR-1 makes this an identity distinction precisely so it
cannot be done by accident, and `require_human()` elsewhere in the SDK only
means anything if jobs are honest about what they are.

Service tokens are also deliberately shorter-lived than user ones (15 minutes
against an hour). ADR-1 chose a library over a service, so there is no central
revocation path; lifetime is the only control. A job that runs longer than its
token should re-authenticate rather than hold one open.

## What you get, and where it is decided

| Behaviour | Comes from | Why it is not yours |
| --- | --- | --- |
| Service identity, verified against your tenant | `run_job()` | ADR-1. A job attributed to a person corrupts the audit trail. |
| Started / completed / duration / failure signals | `run_job()` | ADR-4. A job is judged on whether it ran, not on latency. |
| `tenant_id` + principal on every log line | `run_job()` | ADR-3 gate 2. |
| Tenant scoping on every query | `context.warehouse` | ADR-3 gate 3. No parameter exists through which to ask for another tenant's rows. |
| Audit record per data access | the data client | ADR-4, written before the fetch. |

## Failures belong to the scheduler

`run_job()` logs the error class and re-raises. Let it. Catching the exception
and exiting zero turns a failed export into a successful no-op: nobody is paged,
the dashboard stays green, and the data is silently stale — the worst outcome
available.

The container runs once and exits; the platform scheduler owns the cadence and
reads the exit code. Do not put a loop, a cron expression, or a retry policy in
your job. Twenty-five jobs with their own retry semantics is twenty-five failure
behaviours an operator has to learn during an incident.

## Telemetry will refuse things you want to log

`context.log.info("rows", rows=rows)` raises. That is ADR-4's main control and
it is aimed at exactly this line — the realistic way sensitive data reaches an
operator's screen is a well-meant log statement, not a malicious query. Log
`row_count=len(rows)`.

## Checks that run before you commit

`.pre-commit-config.yaml` carries the two ADR-3 rules whose failures cannot be
walked back:

- **Secret scanning** — a credential in git history has to be rotated, not
  deleted, and rotation is manual today (ADR-5 item 6).
- **Job-contract conformance** (`scripts/check_job_contract.py`) — ADR-3 asks
  for health-contract conformance in CI so that ADR-4's operator view works
  across every app. A job has no `/health` to poll, so the equivalent assertion
  is that the body runs through `run_job()` and receives a service principal.
  Both are things a tenant can break in a way that reads fine in review.

`--no-verify` still works and is not being removed (ADR-3). The bypass is
recorded; that record is the control.

## Deployment

The `Dockerfile` runs as a non-root user (uid 10001). No port, no healthcheck —
there is nothing to poll. Configuration arrives as environment variables.
