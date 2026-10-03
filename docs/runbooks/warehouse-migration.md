# Runbook: warehouse cluster migration, 14–15 November

**Owner:** platform team · **Window:** Fri 14 Nov 22:00 UTC → Sun 16 Nov 06:00 UTC

## What tenants need to do

**Interactive apps:** nothing. They will fail while the warehouse is unreachable
and recover on their own. The SDK surfaces this as a 502 with "Data source
failed", not as a wrong answer.

**Scheduled jobs:** either pause anything scheduled inside the window, or
confirm your job is safe to retry. `jobs.run()` re-raises on failure and leaves
the scheduler to decide — if your scheduler does not retry, a run in the window
is a run you lose.

**The one thing that would actually hurt:** a job that catches the data error
and writes a partial result anyway. If yours does that, pause it.

## Why queries fail rather than return stale rows

The read replica is torn down with the old cluster rather than left serving. A
stale spend figure that looks current is worse than a visible outage — the same
reasoning as ADR-1's preference for a stopped app over a wrong number.

## Platform team sequence

| When | Step | Rollback |
|---|---|---|
| T-7d | Notify every tenant owner; publish this runbook | — |
| T-1d | Confirm per-tenant grants exist on the new cluster and match `tenants/*.yaml` | — |
| T-0 | Stop writes, final sync | Resume old cluster |
| T+2h | Repoint `INSIGHTS_WAREHOUSE_URL`, restart stubs/services | Repoint back |
| T+3h | Smoke: `./scripts/verify-guarantees.sh` must pass in full | Repoint back |
| T+4h | Re-enable paused schedules, notify tenants | — |

**Rollback is viable until schedules are re-enabled.** After that, re-pointing
means replaying any job that ran against the new cluster.

## The step most likely to go wrong

Grant recreation at T-1d. Grants are maintained by hand and nothing verifies
them (ADR-5 item 3), so a migration is exactly when a tenant silently ends up
with wider or narrower access than they had. **Diff the new cluster's grants
against `tenants/*.yaml` manually before T-0, and have the People Analytics
data owner confirm their column-level restrictions survived.**

If grant-drift detection exists by November, run it instead.

## Checks that must pass before declaring done

- `./scripts/verify-guarantees.sh` — all checks, not a subset
- A restricted-tier read succeeds *and* a cross-tenant token is still refused
- One scheduled job completes end to end with an audit record
