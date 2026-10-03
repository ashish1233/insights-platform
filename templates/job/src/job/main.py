"""Scheduled batch job — the second scaffold, and deliberately not the first one
with the web parts removed.

A job differs from a web app in the thing that matters most here: **there is no
user behind it**. ADR-1 makes that an identity distinction rather than a
convention, and `jobs.run()` is where it is enforced — the harness fetches a
*service* token from the identity provider and hands your body a service
principal.

Do not work around this. The tempting shortcut is to mint a user token for a
"service account" person, or to reuse a token captured from a web session,
because it makes scope grants simpler. It also makes the audit trail ADR-4
depends on a lie: an auditor reading "alice@ read the compensation dataset at
03:00" has no way to know alice was asleep. Some actions refuse service
identities outright (`require_human`), and that refusal only works if jobs are
honest about what they are.

The other difference is what you are judged on. A web app is judged on latency
and error rate; a job is judged on whether it ran at all, how long it took, and
whether it has quietly stopped running. `jobs.run()` emits those signals for
you — which is why your body goes *inside* it rather than beside it.
"""

from __future__ import annotations

import asyncio
from typing import Any

from insights_platform import JobContext, load_config, run_job

# TODO(team): the job's name. It appears in telemetry, in audit records as
# `service:<name>`, and in the service-token request — so make it the name an
# operator would search for at 3 a.m., not an abbreviation.
JOB_NAME = "todo-your-job"

# TODO(team): the warehouse dataset this job reads.
DATASET = "TODO_your_dataset"


async def body(context: JobContext) -> dict[str, Any]:
    """TODO(team): the actual work.

    `context` carries everything the platform provides: `config`, `principal`
    (a service identity), `warehouse`, `rest`, `audit`, and `log`.

    Raise on failure. `run_job` logs the error class and re-raises, and the
    scheduler decides what a failure means — swallowing it here would turn a
    failed export into a successful no-op, which is the worst outcome available
    because nobody is paged and the data is silently stale.
    """
    rows = await context.warehouse.fetch(context.principal, DATASET)

    # Counts and identifiers, never rows (ADR-4). `context.log.info(rows=rows)`
    # raises, on purpose.
    context.log.info("Read dataset.", dataset=DATASET, row_count=len(rows))

    return {"row_count": len(rows)}


async def main() -> None:
    config = load_config()

    # `run_job` is the harness: it exchanges the deploy-time credential for a
    # short-lived service token, verifies it against this tenant, binds tenant
    # and principal to telemetry, and times the run.
    await run_job(JOB_NAME, body, config=config)


def main_sync() -> None:
    """Console-script entrypoint.

    One invocation per scheduler trigger. The platform scheduler runs this
    container on its cadence and interprets the exit code; the job does not own
    a loop, a cron expression, or a retry policy, because those in twenty-five
    repositories are twenty-five different failure behaviours for an operator to
    learn.

    A non-zero exit is the correct outcome of a failed run — do not catch and
    exit zero to keep a dashboard green.

    TODO(team): agree your schedule with the platform team. A job nobody
    scheduled is a job that never runs, and "has it silently stopped?" cannot
    distinguish that from a job that was never deployed.
    """
    asyncio.run(main())


if __name__ == "__main__":
    main_sync()
