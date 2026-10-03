"""The test the platform expects every job to keep passing.

Delete nothing here. Add your own tests alongside it.

It does not test the SDK — the platform team does that. It tests that this job
is still wired to the harness, which is the thing a tenant can break, and which
looks entirely fine in code review when it is broken.
"""

from __future__ import annotations

import asyncio
from unittest.mock import patch

from insights_platform import PrincipalKind, issue_token
from insights_platform import jobs as sdk_jobs

from job import main as job_module


def test_job_runs_as_a_service_principal():
    """ADR-1: a job has no human behind it, so it gets its own identity kind.

    A user token here would make the audit trail ADR-4 depends on say that a
    person read the data at 03:00. The lie is invisible until an auditor acts
    on it, which is why this is checked rather than trusted.
    """
    seen: dict[str, object] = {}

    async def fake_idp_token(config, job_name):
        # The stand-in IdP can only mint a service token. A job that wanted a
        # user token would have to go somewhere other than the harness for it.
        return issue_token(
            kind=PrincipalKind.SERVICE,
            subject=job_name,
            tenant_id=config.tenant_id,
        )

    real_run = sdk_jobs.run

    async def watched_run(name, body, *, config):
        async def watched_body(context):
            seen["kind"] = context.principal.kind
            seen["describe"] = context.principal.describe()
            seen["is_service"] = context.principal.is_service
            return None  # the query is not what this test is about

        return await real_run(name, watched_body, config=config)

    with (
        patch.object(sdk_jobs, "_fetch_service_token", fake_idp_token),
        patch.object(job_module, "run_job", watched_run),
    ):
        asyncio.run(job_module.main())

    assert seen["is_service"] is True
    assert seen["kind"] is PrincipalKind.SERVICE
    assert seen["describe"] == f"service:{job_module.JOB_NAME}"
