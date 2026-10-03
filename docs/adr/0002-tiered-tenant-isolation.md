# ADR-2: Tiered isolation and platform-owned access

**Status:** Accepted · **Date:** 2026-10-03

> **In short.** Tenants are teams of employees and the organisation has recourse, so the
> threat is carelessness, not malice — soft isolation plus a complete audit trail is the
> right default, and twenty-five hardened stacks are unaffordable for three engineers.
> People Analytics is the exception, because their disclosure cannot be walked back.
> **Authorization is a platform capability, not an IT ticket:** each app declares its
> scopes, its owner grants them, and the platform enforces and records every grant. The hub
> composes only what the signed-in user may see — and the one irreversible dataset gets a
> second, independent boundary on top of that.

## Context

Most data here is ordinary internal reporting: spend, headcount. One tenant, People
Analytics, holds compensation data, and their compliance partner reviews this design before
they onboard.

The instinct is to isolate everything from everything, as a public SaaS would. That instinct
is wrong here, and the brief says why:

> Every tenant is a team of employees. The platform is internal-only. You have observability
> into what runs, and organizational recourse when a team misbehaves.

That defines the threat model. We are not defending against someone who bought a seat in
order to reach other tenants' data. We are defending against **a colleague writing a careless
query** — a missing tenant filter, a debug route left on, a notebook joining two datasets it
should not. The failure is accident, and the answer to accident is detection and correction.

Uniform hard isolation is also unaffordable: twenty-five separately provisioned stacks is not
something three engineers operate while also building the platform.

But "mostly accidents" is not an argument a compliance partner will accept about compensation
data, and it should not be.

The brief also names **authN/authZ as a shared need the platform must meet**. A platform that
hands authorization back to a ticket queue has not met it.

## Decision

### Authorization is owned by the platform

**Identity comes from corporate SSO. Permissions come from the platform.** That split is the
whole of it: the directory says who you are, the platform says what you may do.

- **Each app declares the scopes it defines** in its tenant manifest — what they mean, and
  which data they unlock.
- **The app owner grants and revokes them**, themselves, in the platform. No ticket, no
  intermediary, effective immediately.
- **The platform mints tokens carrying those scopes** and enforces them at runtime. A client
  never names its own scopes.
- **Every grant, revocation and use lands in the same audit store** (ADR-4). "Who authorised
  this, and who then used it" is one query against one system.
- **Service identities** for scheduled jobs are granted the same way, by the same owner, and
  carry no human's name.

Two things are deliberately *not* the owner's to decide:

- **Tier.** Assigned by the platform team, because it carries compliance obligations an owner
  cannot waive on the organisation's behalf.
- **Restricted-tier grants.** Granting a scope that unlocks confidential data requires the
  tenant's named data owner as a second approver, matching ADR-4's break-glass rule.

**There are no roles.** A role is a named bundle of scopes; until several tenants converge on
the same bundle, modelling it is guesswork about other people's org charts.

### Tier decides the data controls

**Two tiers. Not one, and not three.**

| | Standard — default | Restricted — People Analytics |
|---|---|---|
| Warehouse | shared connection, one role per tenant | plus column-level grants on the most confidential fields |
| Scope checks | SDK helpers; the route may skip them | enforced by middleware, not skippable |
| Audit | fail-open — events buffer, request proceeds | **fail-closed** — no record, no access (503) |
| Derived data | shared caches permitted | nothing derived leaves the tenant's storage |
| Operator access to rows | break-glass, second platform engineer | break-glass, **tenant's own data owner** approves |

### Composition follows authorization, and the restricted tier gets a second boundary

**The hub mounts only the apps the signed-in user is authorised for.** That is what makes
composing them safe at all: a finance-only user never has the compensation app in their page,
so there is nothing there to reach. The only person who can hold two apps at once is someone
the platform has already granted both, and for them one app seeing the other discloses
nothing they were not entitled to see. Composition is a *consequence* of the access model,
not a separate control.

**For the restricted tenant we also give the app its own page.** Not because the other apps
are untrusted — the access model above already handles that — but because this is the one
dataset where being wrong cannot be corrected afterwards. A second boundary that does not
depend on our own authorization logic being correct is cheap insurance on exactly the dataset
that warrants it.

The two layers fail independently, which is the point:

| If this fails | This still holds |
|---|---|
| A scope is granted to the wrong person | The app is still on its own page — nothing *else* in the hub can reach it |
| An app in the hub behaves badly | The compensation app was never in that page to begin with |

Standard-tier apps get the first layer only, because for reversible data the audit trail is a
sufficient second line and a separate page would cost those tenants convenience for no gain.

## Why

**Soft isolation is correct because the threat is carelessness.** Against an accident, a
complete audit trail plus a database role that makes the accident impossible to widen is
worth more than architectural separation — and costs a fraction to operate.

**The restricted tier exists because "we'd detect it tomorrow" is not an answer here.** For
most datasets, finding a bad query the next morning is fine: you correct it, tell the data
owner, move on. For genuinely confidential data the disclosure has already happened. Where
the harm is irreversible the control must be preventive, not detective. **That is the whole
basis for the split — not sensitivity in the abstract, but whether the damage can be walked
back.**

**Authorization belongs in the platform because that is what the platform is for.** The brief
lists authN/authZ among the needs every app shares. Routing permission changes through a
central queue would leave each team waiting on someone who does not know what
`insights:read_sensitive` unlocks, and would put three engineers — or worse, an unrelated
team — in the path of every access decision at twenty-five tenants. Self-service is also the
only shape whose cost does not grow with tenant count, which is the constraint ADR-1 is built
around.

**The app owner is the right approver.** They know who is on their team, what their data
means, and who has a reason to see it. A central administrator knows none of those things and
approves on vibes.

**One audit store is worth more than one approval queue.** The compliance partner's real
question is not "was there a process" but "who authorised this person, and what did they then
read". Keeping grants and accesses in the same append-only store makes that a single query
instead of a reconciliation between two systems.

**Fail-closed audit is a deliberate availability sacrifice, and only in one tier.** An
unrecorded read of confidential data is worse than an outage: the outage is visible, bounded
and fixable. We refuse the same trade in the standard tier, where it would turn a telemetry
failure into a platform-wide outage for no proportional gain.

**Two tiers, capped.** Every tier is a separate paved road — defaults, docs, smoke tests,
failure modes the team must hold in their heads. Three engineers can carry two. When a third
is proposed, the honest answer is to tighten the second or decline the tenant.

## Alternatives considered

| Option | Why not |
|---|---|
| Uniform hard isolation | Defensible on security alone; three engineers cannot run 25 stacks, and it defends against a threat this environment does not have |
| Uniform soft isolation | Adequate for 24 of 25 tenants; fails the compliance review that gates the 25th |
| Per-tenant negotiated controls | Makes every onboarding a design exercise — the effort-per-tenant cost ADR-1 exists to avoid |
| Authorization via directory groups | One less system to build, but puts a central queue in the path of every access change and splits the audit trail across two systems at exactly the moment someone asks who approved what |
| Roles rather than scopes | Convenient, but modelling other teams' org charts before they ask is guesswork; revisit when several converge on the same bundle |
| Separate pages for *every* app | The per-user mount already covers reversible data; charging twenty-four tenants a worse experience for a boundary they do not need is the kind of uniform strictness this design rejects elsewhere |
| Relying on the access model alone, with no separate page anywhere | Adequate right up until an authorization bug, which on this one dataset is unrecoverable. The second layer costs one tenant some convenience and removes a single-point-of-failure |

## Consequences

- **The platform now owns an authorization surface** — grant, revoke, list, audit. Real
  software to maintain, and it is on the critical path of every tenant's access.
- **An owner can over-grant.** Self-service means mistakes are fast too. The mitigations are
  that every grant is recorded and attributable, restricted scopes need a second approver,
  and scopes are narrow enough that over-granting one is rarely catastrophic.
- **Two code paths** through data access and middleware, and the restricted one is exercised
  by a single tenant — so it is the one that rots. It needs its own smoke test every release.
- **Restricted-tier apps are less available, by design.** People Analytics must be told this
  during onboarding, not discover it during an incident.
- **Warehouse grants are maintained by hand.** The most likely source of a quiet
  misconfiguration — see ADR-5, where it is named as the weakest point in the design.
- **The standard tier's guarantee is honest but modest:** your data is scoped by a role and
  every access is recorded. It is not "no other tenant can ever read this."
- **Residual risk in the hub:** a compromised dependency inside one app could reach data in
  another *for a user who holds both*. That is a supply-chain problem, not an isolation one,
  and the answer is dependency governance rather than architecture. Not addressed today.

## Revisit when

- **A tenant appears who is not a team of employees.** The soft default loses its
  justification immediately — organizational recourse no longer reaches them, and the
  per-user mount argument weakens with it.
- **A second tenant needs restricted tier for a different reason.** Two tiers have stopped
  describing reality.
- **A standard-tier cross-tenant exposure occurs** — the role backstop has a hole and the
  default needs tightening for everyone.
- **A dependency in one app is found reaching another's data.** The second boundary already
  protects the restricted tenant; this would be about the rest, and the answer is dependency
  governance or extending separate pages further down the tiers.
- **Owners routinely grant scopes they do not understand.** The scope descriptions are
  failing, not the model — fix the vocabulary before taking the capability away.
- **Grant drift causes an incident**, converting ADR-5's accepted risk into funded work.
