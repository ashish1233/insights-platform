"""Stub audit sink — append-only, and operated by somebody else.

ADR-4 turns on one structural claim: the audit store is **outside the platform
team's control**. It is operated by a different group — security or IT — precisely
so that the people whose access is being recorded are not the people who
administer the recording. An audit log the audited party can edit is theatre, and
a compliance partner will identify it as theatre in one question.

That decision is why this service is a separate process with its own deployment
and its own README rather than a table inside the platform's database, and it is
why the API below is deliberately incomplete:

    POST /events     append
    GET  /events     read
    GET  /health     liveness

There is no DELETE, no PUT, no PATCH, and no truncate. Not "disabled by
configuration" — absent from the code, because configuration is administered by
somebody, and the point of ADR-4 is that the somebody is not us. FastAPI answers
405 for the verbs that do not exist here, which is the correct answer: not
"forbidden for you", but "this store does not do that for anyone".

Storage is a Python list, which is honest about what a stub is. The real store is
durable and write-once (object-lock or an equivalent), has a retention policy set
by the operating team, and is the thing People Analytics' compliance partner holds
a standing read on for their own tenant's slice — without asking the platform
team for it. That standing read is what `GET /events?tenant_id=...` stands in for.
"""

from __future__ import annotations

import dataclasses
import itertools
import threading
import time
from typing import Any

from fastapi import FastAPI, Query
from pydantic import BaseModel

from insights_platform.audit import AuditEvent

SERVICE_NAME = "stub-auditlog"

app = FastAPI(
    title="Insights Platform — stub audit sink",
    description=(
        "Append-only audit store. Read and append only; this API has no mutating "
        "verbs by design (ADR-4)."
    ),
    version="0.1.0",
)


class AuditEventIn(BaseModel):
    """Wire shape of `insights_platform.audit.AuditEvent`.

    Mirrored rather than imported as a model because the SDK's version is a plain
    frozen dataclass and this service must not grow a runtime dependency on the
    SDK's internals. `_assert_contract_matches_sdk` below keeps the mirror honest.
    """

    tenant_id: str
    principal: str
    action: str
    resource: str
    result: str
    ts: float


class StoredEvent(AuditEventIn):
    """What a reader gets back: the event, plus what the store itself observed.

    `seq` and `received_at` are added by the store and are not caller-supplied.
    An event's own `ts` comes from the machine that emitted it, so it can be
    wrong, skewed, or repeated; `seq` is the store's own monotonic record of
    arrival order and is what makes "newest first" well-defined.
    """

    seq: int
    received_at: float


def _assert_contract_matches_sdk() -> None:
    """Fail at import if the SDK's AuditEvent and this model have diverged.

    Cheap, and it catches the failure mode that would otherwise be silent: the
    SDK adds a field, this sink quietly drops it, and the gap only surfaces
    during an audit — the one moment when discovering it is most expensive.
    """
    sdk_fields = {f.name for f in dataclasses.fields(AuditEvent)}
    stub_fields = set(AuditEventIn.model_fields)
    if sdk_fields != stub_fields:
        raise RuntimeError(
            "Audit event contract drift. "
            f"SDK AuditEvent has {sorted(sdk_fields)}; this sink accepts "
            f"{sorted(stub_fields)}. Update AuditEventIn to match the SDK."
        )


_assert_contract_matches_sdk()


# Append-only storage. The lock guards the (append, assign seq) pair so two
# concurrent writers cannot be handed the same sequence number; uvicorn runs this
# app's sync-safe paths on a threadpool, so this is not theoretical.
_events: list[StoredEvent] = []
_seq = itertools.count(1)
_lock = threading.Lock()


@app.post("/events", status_code=201)
async def append_event(event: AuditEventIn) -> dict[str, Any]:
    """Append one event. 201, because this creates a record that now exists forever.

    The SDK calls this *before* the access it describes, not after (see `data.py`),
    so a non-2xx here is what makes the restricted tier fail closed. This endpoint
    therefore has exactly one job and does it without any optional behaviour: no
    deduplication, no validation of the principal against anything, no rewriting.
    A sink that can reject an event for a judgement call is a sink that can be
    argued into dropping one.
    """
    with _lock:
        stored = StoredEvent(
            **event.model_dump(),
            seq=next(_seq),
            received_at=time.time(),
        )
        _events.append(stored)

    return {"recorded": True, "seq": stored.seq}


@app.get("/events")
async def read_events(
    tenant_id: str | None = Query(
        default=None,
        description=(
            "Restrict to one tenant's slice — the standing read a tenant's "
            "compliance partner holds. Omitted, this is the platform operator "
            "view, which ADR-4 permits across tenants because audit events record "
            "the fact of an access and never its contents."
        ),
    ),
    action: str | None = Query(default=None),
    limit: int = Query(default=200, ge=1, le=10_000),
) -> dict[str, Any]:
    """Read events, newest first.

    Newest-first is the operator's default because the question being asked is
    almost always "what just happened", and an append-only store grows without
    bound in the other direction.
    """
    with _lock:
        snapshot = list(_events)

    # Sorted by arrival, not by the emitter's clock: `ts` is attacker- and
    # bug-influenced, `seq` is ours.
    selected = [
        event
        for event in reversed(snapshot)
        if (tenant_id is None or event.tenant_id == tenant_id)
        and (action is None or event.action == action)
    ]

    return {
        "events": [event.model_dump() for event in selected[:limit]],
        "count": len(selected[:limit]),
        "total_matching": len(selected),
    }


@app.get("/health")
async def health() -> dict[str, Any]:
    return {
        "status": "ok",
        "service": SERVICE_NAME,
        # Event count is metadata, not content, so an operator may see it under
        # ADR-4's default access. A flat count across a busy tenant is also the
        # first signal that an app has stopped recording.
        "event_count": len(_events),
    }
