# ADR-1: How shared behaviour reaches apps, and how it changes

**Status:** Accepted · **Date:** 2026-10-03

> **In short.** The platform ships as a versioned library plus two scaffolds, not as
> services — three engineers cannot operate request-path infrastructure for 25 teams.
> Upgrades are pull, like any dependency: we publish, tenants take it when they want it.
> The risk that actually matters is not teams running old versions, it is teams
> *rebuilding* what already exists, so release notes and the hub are written to make new
> capability findable. Security runs in two steps: we **contain immediately** with the
> infrastructure we own — tightening warehouse grants, rotating the signing secret — so the
> hole stops mattering today, then publish the fix with a deadline. Missing it costs a
> tenant their warehouse credentials, never their code.

## Context

Five teams today, plausibly twenty-five in two years. Each currently hand-rolls auth, data
access, logging and deployment.

Twenty-five tenants is not many, and nothing here is load-bound. The variable that actually
breaks under growth is **platform-team effort per tenant** — three engineers who also
maintain, upgrade and support everything they build. Any mechanism whose cost grows with
tenant count eventually consumes the team. That single constraint decides most of what
follows.

## Decision

**A versioned Python library plus two scaffolds** — `templates/web/` and `templates/job/`.
Teams install the library and copy a scaffold once.

**Repository boundaries follow shared code, not shared authorship.** Two things belong in
one repository when a change has to land in both at once. Six repositories:

| Repository | Consumers | Published as |
|---|---|---|
| `insights-sdk-python` | every backend and job | a Python package |
| `insights-ui-kit` | every frontend | an npm package |
| `insights-platform` | the platform team | nothing — stubs, scaffolds, hub, ADRs, tenant manifests |
| three tenant repositories | their own team | deployed apps |

**The SDK and the UI kit are separate and version independently.** They share no code — no
import crosses between them — and they do not share a toolchain, a release rhythm, or a
consumer set. A scheduled job pulls the SDK and will never want the UI kit.

**Upgrades are pull.** We publish a release with notes and a migration guide. We do not open
pull requests in tenant repositories and we do not merge in them. We support the current
major and the one before.

**Release notes answer "what can you now delete?"**, not "what did we change?".

**Security is the one exception, and it happens in two steps — contain first, patch second.**

A pull model has an obvious hole: if the fix only lands when each team chooses to take it,
the vulnerability is live in the meantime. Twelve teams, a week each, is a week of exposure
while we send polite reminders. That is not acceptable and it is not what happens.

**Step one, immediately, without touching anyone's code.** The bug is in a library we cannot
reach, but the thing it guards is infrastructure we own. Depending on the hole, we:

- **tighten the warehouse grants** so the data is unreachable even by a caller who gets past
  the broken check — the backstop ADR-2 exists to provide;
- **rotate the token signing secret**, which invalidates every token in flight;
- **stop the identity provider issuing the affected scope** at all.

The bug is still present in twelve apps. It has stopped mattering. This takes minutes and
needs nobody's cooperation, because every one of these levers is on our side of the line.

**Step two, the actual fix.** We publish the patched version with a severity, a description
of the exposure, and a deadline, and notify each affected team directly rather than relying
on them watching a feed. They upgrade and test on their own terms.

**If the deadline passes**, we revoke that tenant's warehouse role until they patch. By then
this is about removing a known defect rather than stopping active exposure — containment
already did that — so the deadline can be generous enough that nobody reaches it by accident.

The ordering is the point: **containment is ours and is instant; the fix is theirs and can
take the time it needs.**

## Why

**Library over services, because of team size.** A service on the request path is something
three people keep alive at 3am, forever, for twenty-five tenants. A library has no runtime to
operate; it fails in the tenant's own CI where they can see it. The services we do run
(identity, warehouse, audit) sit deliberately *off* the hot path — an app that has already
authenticated keeps serving if they are down.

**Pull over push, because push does not scale and does not help.** An earlier draft had the
platform team open an upgrade PR in every tenant repository. Three problems with that.

**It is not what these three people are for.** A platform team of two or three exists to
build and support the substrate. Spending their week editing other teams' application code
is the clearest possible sign the platform has stopped being a platform and become a shared
services desk — and the work only grows, by one more repository every time someone joins.

**They do not know those codebases.** At twenty-five apps, let alone fifty, nobody on the
platform team has read most of them. Authoring a migration against code you have never seen,
for a domain you do not understand, is not help.

**And it moves the blast radius to the worst possible place.** An upgrade can change
behaviour in ways that compile cleanly — a column that now returns null instead of being
omitted, a rounding change, a different default. Touching twenty-five repositories means one
mistake lands in twenty-five production apps at once, authored by someone who cannot tell
which of the resulting numbers are wrong.

**And we could not safely merge them anyway.** A platform engineer can verify that a
migration compiles and that our tests pass. They cannot verify that a tenant's quarterly
reconciliation still produces the right number. Having the authority to merge does not confer
the knowledge to merge, and a change that is correct against the SDK and subtly wrong against
the business is worse than an unpatched library — the first failure is visible, the second is
a number someone acts on.

**So the escalation is infrastructure, not code.** We own the credentials; tenants own their
logic. An unpatched vulnerability past its deadline costs a tenant their data access. That
fails safe, and it is the only lever that still works at a hundred tenants.

**The real risk is rebuilding, not staleness.** Being a version behind costs a team little.
Spending a fortnight writing an export helper that shipped last month costs them a fortnight
and costs the platform its reason to exist. That is a *discoverability* failure, and pushing
version bumps does nothing for it — a team that does not know a capability exists will not
learn it from a dependency diff. Hence notes written as an offer, and the hub turning each
app's reported SDK version into "here is what you are missing".

**Two scaffolds, because web apps and batch jobs share nothing but the SDK** — different
runtime, identity, observability signals and deployment. One template would make half of
every team's first day consist of deleting the irrelevant half.

## Alternatives considered

| Option | Why not |
|---|---|
| Platform as services | Better enforcement, but three engineers cannot carry on-call for request-path infrastructure serving 25 tenants |
| Monorepo with all tenant apps | Couples 25 teams to one release cadence, and dissolves the tenant boundary ADR-2 depends on |
| Copy-paste scaffold, no library | Makes every future fix a 25-way reimplementation — the problem the platform exists to end |
| One repository for everything the platform team writes | Tempting at three engineers, and it was the first answer here. Rejected: "we release it together" is a statement about us, not about the code. The SDK and UI kit share nothing, so co-locating them would hide an API contract behind a directory structure instead of making it explicit |
| Platform force-merges security fixes | Rejected — see above. We lack the domain knowledge, not the authority |

## Consequences

- **Upgrade timing is out of our hands.** "Every app is on a supported version" becomes a
  goal we chase, not an invariant we hold.
- **Release notes become a real deliverable.** In a pull model they are the distribution
  mechanism; a release whose notes do not say what a team can stop maintaining has not
  really shipped.
- **Revoking a role is a genuine outage**, and will one day be done to a team that disagrees.
  Writing the policy down before it is needed is what keeps it legitimate rather than
  arbitrary.
- **Two scaffolds means two paved roads to smoke-test** on every release.
- **One CI pipeline for platform artifacts** will eventually be a bottleneck. Invisible at
  three engineers; it will not stay invisible.

## Revisit when

- **A change starts needing to land in the SDK and the UI kit at the same commit.** That
  would mean real shared code has appeared and the split is now costing us; today there is
  none, and the only thing crossing between them is an HTTP contract.
- **Keeping the two in step becomes manual work** — someone remembering that one needs
  bumping when the other ships. That is the signal the contract between them needs to be a
  versioned artifact of its own rather than an understanding.
- **Several tenants independently build the same thing.** That is the pull model failing at
  its one job. Fix the publishing before concluding that teams need pushing.
- **A security deadline arrives and revocation turns out to be unusable** — mid-quarter-close,
  or an app the business cannot take down. The escalation only works if it is survivable.
- **A tenant appears who is not a team of employees.** Credential revocation assumes a shared
  employer and incident process; with a contractor or partner it becomes contractual, and the
  soft-trust posture in ADR-2 loses its basis too.
