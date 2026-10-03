# ADR-5: Deliberate omissions

**Status:** Accepted · **Date:** 2026-10-03

> **In short.** Eight things deliberately unbuilt, each with a trigger someone could
> actually check — not "when we scale". The largest is the authorization surface ADR-2
> describes: enforcement is real and tested, issuance is stubbed, and that sequence is
> deliberate because enforcement is what makes a wrong grant survivable. The most
> dangerous is manual warehouse grants, which nothing verifies — it sits underneath a
> guarantee already made to a compliance partner.

## Context

Everything this platform ships, two or three engineers maintain, upgrade, and support
indefinitely. The scarce resource is not build time — it is the permanent carrying cost of
each component. A platform that is 40% built and honest about the other 60% is more useful
than one that is 90% built and silently fragile across all of it.

So omission is a design decision, and it is only a decision if it comes with a **trigger** —
something an observer could check to say "that condition has now been met". *"When we scale"*
is a deferral. *"When a tenant exceeds a quarter of warehouse capacity"* is a decision.

Several items below are not generic missing features. They are **debts created by choices made
in ADRs 1–4**, and they are listed here so the cost of those choices is visible in one place
rather than scattered across four documents.

## Omitted, with triggers

### 1. Per-tenant quotas and rate limiting

**Not built.** Nothing stops one tenant's badly-written query from consuming the shared
warehouse connection and degrading the other twenty-four.

**Why not.** This is the first thing a reviewer expects to see in a multi-tenant platform, and
it is the wrong instinct here. Twenty-five tenants running internal reporting is not a load
problem; the expected steady state is well under capacity. Building quotas now means tuning
limits with no real traffic to tune against, and the limits would be wrong. Meanwhile the
actual noisy-neighbour event, when it happens, will be one identifiable colleague running one
identifiable query, and the fastest remedy is a conversation — which this environment permits
and a public platform does not.

**Trigger.** Any single tenant sustains more than ~25% of warehouse connection capacity over a
business day, or a second noisy-neighbour incident occurs after the first has been discussed.
The second incident is the real signal: one is an accident, two is a structural gap.

### 2. The authorization surface itself

**Not built.** ADR-2 says an app owner grants and revokes scopes in the platform. There is no
grant store, no API and no UI. Scope *enforcement* is real — middleware refuses a caller
lacking the declared scope, and the hub shows only apps whose scope the user holds — but
issuance is stubbed: the development identity provider mints whatever a caller asks for, and
says so in its own docstring.

**Why not.** It is the largest single piece of software in the design and the one that most
needs to be got right. Building a half-version in the remaining time would have produced a
grant store with no approval path, no revocation audit, and no second-approver rule — all
three of which ADR-2 commits to. An honest gap beats a surface that looks finished and
quietly isn't.

**This is the biggest unbuilt thing here**, and the ordering matters: enforcement first,
issuance second, is the right sequence, because enforcement is what makes a wrong grant
survivable.

**Trigger.** The first real tenant. There is no version of onboarding a team that works
without it — until then access is set by hand, which is fine for two demo tenants and
nothing beyond.

### 3. Automated warehouse grant provisioning

**Not built.** The per-tenant warehouse roles that back ADR-2's isolation are created and
maintained by hand.

**Why not.** At five tenants this is an hour of work a quarter. Automating it means owning a
provisioning system with write access to database grants — a high-privilege component, for
three engineers, to replace a task currently measured in minutes.

**This is the weakest point in the whole design**, and it should be read as such: ADR-2's
isolation guarantee rests on grants that no automated process verifies. A typo gives a tenant
access they should not have, silently, with nothing to catch it.

**Trigger.** Either tenant count passes ten, or the first grant-drift incident, whichever
comes first. An interim mitigation — a read-only job that diffs actual grants against declared
tier and alerts on divergence — is roughly a day of work and should be done well before the
full provisioning system is justified.

### 4. SDK API usage telemetry

**Not built.** We do not know which tenants call which SDK functions.

**Why not.** It requires either instrumenting the SDK to phone home — which tenants would
reasonably object to — or static analysis across tenant repositories, which is a tool to build
and maintain.

**The debt this creates.** ADR-1 relies on a supported-version window to move tenants along,
but we cannot assess the blast radius of a breaking change without knowing who uses what. The
first deprecation will be guesswork, and we will either over-support dead APIs or break
someone unexpectedly. In a pull model this matters more, not less — we have no PR going out
to tell us who would have been affected.

**Trigger.** The first time we need to remove or change a public SDK function and cannot answer
"who does this affect?". Static analysis across tenant repos is the cheaper half-measure and
should be built then — roughly two days, no runtime component, nothing tenants can object to.

### 5. Per-tenant staging environments

**Not built.** Tenants have local development and production. There is no shared pre-production
environment the platform team can deploy an upgrade into first.

**Why not.** Twenty-five staging environments is twenty-five more things to operate, and most
tenant apps are thin enough that local development genuinely catches what staging would.

**The debt this creates.** Not tenant safety — ADR-1 leaves every merge with the tenant, so
they decide when a change lands and can test it however they test anything. The debt is ours:
**we ship SDK releases having never run them against a real tenant application.** Our own test
suite is the only thing standing between a bad release and twenty-five teams independently
hitting the same failure over the following weeks — and in a pull model they hit it at
different times, which makes the pattern harder to spot than a single bad rollout would be.

**Trigger.** The first release that passes our suite and breaks a tenant anyway. The fix then
is probably not twenty-five environments but a canary cohort — two volunteer tenants take
each release first, with a bake period before the remaining PRs open. That is a day of policy
and scheduling rather than an estate of environments, and it scales flat as tenants grow.

### 6. Secrets rotation automation

**Not built.** Credentials are issued at onboarding and rotated manually on request.

**Why not.** Rotation automation is meaningful when the credential population is large enough
that manual rotation is unreliable. At five tenants it is a calendar reminder.

**Trigger.** Ten tenants, or any credential exposure incident. An exposure makes manual
rotation a liability immediately, regardless of count.

### 7. Cost attribution and chargeback

**Not built.** We cannot say what any given tenant costs to run.

**Why not.** Nobody has asked, and building attribution before anyone wants it produces a
dashboard nobody reads.

**Trigger.** Finance asks, or the platform's own budget comes under review — at which point
being unable to attribute cost becomes the platform team's problem rather than an abstraction.

### 8. Self-service tier assignment

**Not built, and deliberately so.** Tier is assigned by the platform team, not chosen by
tenants.

**Why not.** Restricted tier carries availability costs that a tenant would not choose
voluntarily and compliance obligations they cannot waive. Self-service here would mean tenants
opting themselves out of controls that exist for the organization's benefit, not theirs. This
is a deliberate exception to the self-service principle everywhere else in ADR-1.

**Trigger.** None. This stays a platform decision at any scale.

## Not planned at any size

- **Multi-region or high availability.** This is an internal reporting platform. A business-
  hours recovery objective is adequate, everyone affected is an employee who can be told what
  happened, and the engineering cost is wildly disproportionate to the harm of a few hours'
  downtime. If someone proposes this, the question to ask is which specific decision is
  blocked by the outage.
- **Role-based access control beyond the two tiers.** Tenants that need internal role
  structure can implement it in their own app; the platform does not need to model it. Revisit
  only if several tenants independently build the same roles, which would be evidence it
  belongs in the SDK rather than in each app.
- ~~**A runtime composition layer**~~ — **superseded by
  [ADR-2](0002-tiered-tenant-isolation.md).** This originally read: rejected because a
  shell puts infrastructure on the critical path of every tenant's user experience, owned by
  three engineers, in exchange for navigational convenience.

  That held at five tenants and stopped holding at twenty-five — twenty-five apps at
  twenty-five URLs is not a platform, it is a list of links someone sent you in chat. ADR-2
  revisits it: the hub composes apps, and does so safely because it mounts only what the
  signed-in user is authorised for. The restricted tenant additionally keeps its own page,
  as a second boundary on the one dataset that cannot be un-shared.

  The original objection was not wrong and is not retired: a shell *is* infrastructure on the
  critical path owned by three engineers. ADR-2 now books that explicitly as the one place
  ADR-1's no-request-path rule is broken, and says what keeps it survivable — every app stays
  independently runnable at its own URL.

  Left visible rather than deleted. A reversed decision, and the reason it reversed, is more
  useful to the next person than a tidy document.

## What we would do next, in order

Given another two days, in priority order and for stated reasons:

1. **Grant-drift detection** (item 3) — one day. It closes the gap beneath ADR-2's central
   claim, and it is the only omission here that silently invalidates a guarantee we have made
   to a compliance partner.
2. **Canary cohort for releases** (item 5) — half a day of policy plus scheduling. Two
   volunteer tenants take each release before it is announced generally, so a bad release is
   caught by one team rather than discovered one at a time over the following month.
3. **Static SDK usage analysis** (item 4) — two days. It converts the upgrade story from a
   stated intention into something measurable.

Everything else waits for its trigger.
