# ADR-3: Where platform rules are enforced

**Status:** Accepted · **Date:** 2026-10-03

> **In short.** A rule lives at the cheapest layer where its failure is still
> *recoverable*. Naming conventions are documentation; a leaked secret is blocked in CI
> because git history cannot be un-written; authentication, tenant-tagged telemetry and
> data scoping are runtime gates because disclosure cannot be undone. Exactly three
> runtime gates, deliberately — each one is surface area three engineers debug at 3am. We
> do not review tenant application code at all; three people cannot be twenty-five teams'
> review queue, and the things worth protecting are enforced by code they cannot skip.

## Context

A platform rule can live in four places: a **convention** written down and followed by
example, a **CI check** that blocks a merge, a **runtime gate** inside the SDK that refuses to
run, or a **review process** where a human looks before something ships.

They are not interchangeable. Each is more expensive than the last — to build, to maintain
forever, and in how much it slows the tenant down. A runtime gate is roughly a hundred lines
the platform team owns, tests on every release, and debugs at 3 a.m. when it misfires. A
convention is a paragraph in a document.

The temptation is to put everything at the strictest layer, because strict feels responsible.
Three engineers supporting twenty-five tenants cannot afford that, and tenants who are fought
by their platform route around it.

## Decision

**A rule lives at the cheapest layer where its failure is still acceptable — and
"acceptable" means recoverable.**

This is the same question ADR-2 uses to split tiers: *can the damage be walked back?* If a
rule's violation can be noticed and corrected afterwards, it belongs at a cheap layer. If the
violation is irreversible the moment it occurs, it has to be prevented, and prevention is
expensive.

Applying that:

### Convention — the default

Directory layout, module naming, where routes live, how configuration is named, which log
message shapes we prefer. Carried by the two templates and by example rather than by
machinery.

*Failure mode:* inconsistency. A reviewer is mildly annoyed; a future maintainer takes longer
to orient. Entirely recoverable, so it never justifies code.

### CI — for things that are irreversible once merged, but cheap to detect

- **Secret scanning.** A credential in git history is not removable in practice; the secret
  must be rotated. Irreversible, so it is blocked before it lands.
- **Dependency on a supported SDK version.** Enforced here rather than at runtime so a tenant
  learns in their own pipeline rather than in production.
- **Health contract conformance** — every app must expose the standard health endpoint, since
  ADR-4's operator view depends on all twenty-five reporting identically.
- **Tests pass.** Not a platform rule so much as what makes ADR-1's pull model workable: a
  team only upgrades on their own schedule if they can tell quickly whether an upgrade broke
  them.

Shipped as pre-commit hooks in both templates and as a reusable CI workflow.

*Bypass:* `--no-verify` exists and we are not removing it. A tenant mid-incident needs an
escape hatch, and a platform that cannot be bypassed during an emergency gets abandoned during
the emergency. The audit trail records that it happened, which is the actual control.

### Runtime — only where disclosure is the failure

Three gates, and deliberately no more:

1. **Authentication.** No identity, no request. Enforced by SDK middleware.
2. **Tenant-tagged telemetry.** Every log and audit event carries `tenant_id` and the acting
   identity. Not optional, because ADR-4's entire operator model is built on it.
3. **Data scoping.** The SDK's data client injects the tenant scope on every query. For
   restricted-tier tenants this cannot be disabled, and audit is fail-closed.

*Failure mode:* data disclosed to someone who should not have it. Unrecoverable — once a
confidential figure has been read, no subsequent action undoes it. This is the only category that
earns a runtime gate.

### Review — reserved, because it does not scale

The platform team reviews **tier assignment** and **changes to the SDK itself**. It does not
review tenant application code. Three engineers reviewing the pull requests of twenty-five
teams is the single fastest way to become the bottleneck the platform was built to remove.

## Why

**Cost asymmetry is the whole argument.** Moving a rule one layer stricter multiplies what it
costs us to own and what it costs a tenant to comply. Moving it one layer looser multiplies the
cost of its failure. The recoverability question is the only honest way to decide which
multiplication you would rather pay.

**Three runtime gates, not thirty.** Every gate is permanent surface area: it must be correct
under concurrency, it must fail comprehensibly, and it will eventually misfire during an
incident and be blamed. Restricting runtime enforcement to authentication, telemetry tagging,
and data scoping means the platform's hard edges are few enough that the whole team can hold
them in their heads — which matters more at 3 a.m. than completeness does.

**Keeping `--no-verify` is a considered choice, not an oversight.** The alternative is a tenant
who cannot ship a hotfix because our secret scanner has a false positive. That tenant will
remember it, and it will cost more trust than the bypass ever costs in risk — particularly
since the bypass is recorded and the environment has organizational recourse.

**Declining to review tenant code is the hardest call in this ADR.** It means tenant apps will
contain things the platform team would not have written, and that some of those things will be
mildly wrong. We accept that in exchange for not becoming a queue. The compensating control is
that the three things we actually care about are enforced by code that tenants cannot route
around, so review was never what was protecting them.

## Alternatives considered

**Everything at runtime** — maximal consistency, nothing drifts, no bypass. Rejected on
maintenance: each gate is permanent surface area for three people, and gates that misfire
during incidents destroy trust faster than inconsistency does.

**Everything in CI** — one place to look, fast feedback, no production risk. Rejected because
CI runs before deployment and the things we care about happen during it. A tenant can pass
every check and still serve unauthenticated requests if nothing enforces it at runtime.

**Platform team reviews every tenant pull request** — catches everything, builds relationships,
teaches the paved road. Rejected on arithmetic. Twenty-five teams is more review throughput
than three engineers have, and the queue would grow until tenants started routing around it,
which is the worst of both outcomes.

**No enforcement; publish guidelines and trust colleagues** — consistent with the soft-trust
posture of ADR-2, and cheapest of all. Rejected because trust addresses malice, and the
failures here are accidents. A careless query is not a trust problem, and no amount of
goodwill prevents one.

## Consequences

- **Standard-tier tenants can technically write code that skips scope checks.** The warehouse
  role is the backstop and the audit trail is the detection. This is an accepted, documented
  gap, not an oversight — see ADR-2.
- **Pre-commit hooks live in the templates**, which means tenants who have diverged far from
  the template may be running stale versions of them. With ADR-1's pull model nothing
  refreshes them automatically, so hook changes have to travel in release notes like
  everything else — and a team that never reads them keeps the old checks indefinitely. The
  honest fix is to ship the hooks as a versioned dependency rather than copied files; that is
  not built.
- **Three runtime gates must never misfire.** They have the strictest test requirements in the
  SDK, including the restricted-tier fail-closed path that nobody exercises in normal
  operation.
- **Bypasses are visible but not prevented**, so the platform team must actually look at the
  bypass log. A control nobody reads is not a control.
- **We will be wrong about a rule's layer at some point** — something currently a convention
  will turn out to be irreversible. The recoverability test gives us a stated basis for moving
  it rather than an argument about how strict to be.

## Revisit when

- **A standard-tier tenant's careless query actually discloses another tenant's data.** The
  recoverability test says data scoping should then become a runtime gate for everyone, not
  just restricted tier.
- **`--no-verify` is used more than rarely**, which would mean the checks are wrong rather
  than the tenants.
- **Tenant count passes roughly forty**, where even reviewing SDK changes and tier assignments
  starts to consume a meaningful share of three engineers.
- **A fourth runtime gate is proposed.** Not forbidden, but it should have to argue against
  this ADR explicitly rather than being added quietly.
