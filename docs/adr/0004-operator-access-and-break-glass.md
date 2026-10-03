# ADR-4: Operator access and break-glass

- **Status:** Accepted
- **Date:** 2026-10-03

## Context

Two or three engineers have to operate twenty-five applications they did not write. To do that
they need to see what is running, what is failing, and why. That is not optional; a platform
whose operators are blind is a platform that cannot be supported.

At the same time, one of those applications holds compensation data, and its compliance
partner will ask a specific question before People Analytics onboards: **what can the platform
team see, and what stops them seeing more?**

The uncomfortable fact that has to be faced directly: the platform team has infrastructure
access. They can reach the warehouse, the secret store, and the hosts. Any design claiming the
platform team *cannot* read tenant data is false, and a compliance partner will identify it as
false within one question. Pretending otherwise is worse than admitting it, because it
destroys confidence in everything else in the document.

So the real question is not how to make operator access impossible. It is how to make it
**narrow by default, deliberate when widened, and impossible to perform quietly.**

## Decision

### Default access — metadata and aggregates only

The platform team has standing read access to:

- Request and job telemetry: route or job name, tenant, acting identity, duration, status, error
  class.
- Health and resource signals across all tenants.
- Audit events: who accessed what dataset, when, from which app — **the fact of an access, not
  its contents**.
- Schema metadata: table and column names, row counts, data freshness.

This is enough to answer the questions operators actually have — *is it up, is it slow, what is
failing, who is calling it* — without any tenant row ever entering an operator's view.

### Telemetry carries no payloads, enforced in the SDK

Keeping data out of logs is a runtime gate under ADR-3, not a guideline. The SDK's logging path
accepts structured fields and refuses arbitrary result sets; query results, request bodies, and
response bodies never reach the telemetry sink. Queries are recorded by shape and parameter
*names*, never parameter values.

This is the control that matters most day to day, because the realistic way compensation data
leaks to operators is not a malicious query — it is a well-meant `log.info(f"rows: {rows}")`
in a tenant's exception handler.

### Raw tenant data — break-glass only

When an operator genuinely must see rows to resolve an incident:

- Access is **requested with a written reason** and is **time-boxed** — one hour, expiring
  automatically.
- It requires a **second approver**. For standard-tier tenants, another platform engineer. For
  restricted-tier tenants, **the tenant's own data owner** — not someone on the platform team.
- The grant, the reason, the approver, and every query executed under it are written to the
  audit store.
- The tenant is notified that it happened, whether or not they approved it.

### The audit store is outside the platform team's control

Break-glass records and tenant access events are written append-only to a store the platform
team's own accounts **cannot modify or delete**. It is written by a service identity that human
operator accounts cannot assume, and it is operated by a different group — security or IT —
precisely so that the people being recorded are not the people administering the recording.

People Analytics' compliance partner holds a **standing read** on their own tenant's slice of
that store, without needing to ask the platform team for it.

## Why

**Narrow default, deliberate exception.** Most operational work needs shape, not content. If
the default view answers the ordinary questions, operators have no habitual reason to reach for
raw data, and reaching for it becomes a visible, unusual act rather than routine.

**The honest limit, stated plainly.** We cannot prevent an engineer with infrastructure access
from reading a database directly. What we can do is make the two paths look very different:
the sanctioned path is easy, logged, and approved; the unsanctioned path requires deliberately
circumventing tooling, and leaves traces in a store the engineer cannot reach. The control is
not impossibility — it is **attribution and conspicuousness**, backed by the organizational
recourse the brief grants. For a compliance partner, "we cannot make it impossible, so we have
made it loud and attributable" is a far more credible claim than "it cannot happen", and it is
the one that survives their second question.

**Separating who is recorded from who administers the recording** is the part that makes any
of this meaningful. An audit log the audited party can edit is theatre. Putting it under a
different group costs us a dependency and some operational friction, and buys the only thing
that makes the rest of this ADR defensible.

**The tenant's data owner approves restricted break-glass, not a second platform engineer.**
Two platform engineers approving each other during a 3 a.m. incident is a weak control — they
share context, urgency, and incentives. The data owner has a different incentive, and their
involvement is what converts approval from a formality into a decision. The cost is latency
during incidents, which we accept for exactly one tier.

## Alternatives considered

**Full operator access to everything, governed by trust and employment** — consistent with the
soft-trust posture of ADR-2, and operationally frictionless. Rejected because it fails the
compliance review that gates People Analytics onboarding, which makes it a non-starter
regardless of its merits.

**No operator access to tenant telemetry at all; tenants self-serve their own observability** —
maximal privacy, and it eliminates this entire problem. Rejected because it makes the platform
unsupportable: twenty-five teams debugging shared infrastructure through the platform team
without the platform team being able to see anything is worse for everyone, and it converts
every incident into a game of telephone.

**Approval by a second platform engineer for all tiers** — simpler, faster, no external
dependency. Rejected for restricted tier only, on the grounds above. Retained for standard
tier, where the latency cost is not worth paying.

**Audit store operated by the platform team, with strong write-once configuration** — much
simpler, no cross-team dependency. Rejected because the configuration is administered by the
party being audited, which is precisely the objection a compliance partner is trained to raise.

## Consequences

- **Debugging a data-shaped bug without seeing data is genuinely harder.** Operators work from
  schemas, counts, query plans, and error classes. The mitigation is that tenants can generate
  a scrubbed sample themselves and share it deliberately — the tenant decides what the platform
  team sees, which is the correct default anyway.
- **Break-glass has real latency**, especially for restricted tier where the approver is
  outside the platform team. During a People Analytics incident this will feel wrong. It is
  the cost of the tier and must be explained during onboarding, not discovered during the
  incident.
- **A cross-team dependency on security/IT** for the audit store. If that team is slow, our
  compliance posture degrades, and we do not control the remedy.
- **The SDK's telemetry path has to refuse things tenants will want to log**, which will
  generate friction and occasional annoyance. Error messages need to explain the refusal and
  point at the scrubbed-sample path, or tenants will work around it.
- **Break-glass logs must actually be read.** A monthly review is part of the platform team's
  operating rhythm, not an aspiration. An unreviewed audit trail is evidence that nothing is
  being audited.

## Revisit when

- **Break-glass is used more than a handful of times a quarter.** That is a signal that the
  default telemetry view is missing something operators genuinely need, and the fix is to widen
  the safe default rather than to normalise the exception.
- **The data owner approval path is routinely bypassed or rubber-stamped**, which would mean
  the control has become theatre and needs restructuring.
- **A second tenant requires restricted tier**, at which point the approval routing needs to
  generalise beyond one named data owner.
- **Security or IT cannot provide an independent audit store.** The honest consequence is that
  the compliance claim weakens and People Analytics should be told so explicitly rather than
  quietly inheriting a weaker control than this document describes.
