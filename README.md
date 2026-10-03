# Insights Platform

A substrate for internal "insight apps" — dashboards, scheduled reports, data
explorers — so that the five teams building them today, and the twenty-five
expected in two years, stop each hand-rolling authentication, data access,
logging, and deployment.

**Start with the ADRs.** The code is evidence that the design survives contact
with reality; the decisions are the actual work. → [`docs/adr/`](docs/adr/)

---

## The shape of it, in one paragraph

The platform is a **versioned Python library** plus **two scaffolds**, not a set
of services. A library has no runtime for a two-to-three person team to operate,
and this environment is unusual in a way that removes the library model's normal
weakness: tenants are colleagues in repositories we can see, with organizational
recourse behind us, so "we can't make anyone upgrade" is answered socially rather
than architecturally. Three things are stubbed because the brief asks for fakes
where real infrastructure would be — an identity provider, a warehouse, an audit
sink. Isolation is **tiered**: most tenants get conventions plus a complete audit
trail, and one tenant — People Analytics, holding compensation data — gets
enforced runtime gates, because that is the only data here whose disclosure
cannot be walked back.

---

## Getting the code

The platform is six repositories that expect to sit **side by side in one
directory** — the SDK and UI kit are consumed by relative path so everything is
editable at once without publishing to a registry first.

```bash
mkdir insights-hub && cd insights-hub
for r in insights-platform insights-sdk-python insights-ui-kit \
         people-analytics-dashboard finance-spend-explorer finance-spend-export; do
  git clone https://github.com/ashish1233/$r.git
done
```

You need `uv`, Node 18+, and nothing else. No cloud account, no real SSO, no
database — every piece of infrastructure here is stubbed.

---

## Run it

**One command, and it checks the runtime guarantees these ADRs make:**

```bash
./scripts/verify-guarantees.sh
```

It starts the stubbed identity provider, warehouse and audit sink, brings up the
restricted-tier app, and then verifies each guarantee against the running
system — a malformed token returns 401 rather than 500, a caller without
`insights:read_sensitive` is refused by middleware before the route body runs, a
token issued for one tenant is rejected by another's app, the audit sink refuses
DELETE, the scheduled job runs as a service identity rather than a borrowed
user, and the restricted tier returns 503 rather than serving data it cannot
record reading.

Each check names the decision it defends, so a failure tells you which document
has become a lie.

Unit tests, which cover the same ground in isolation:

```bash
cd ../insights-sdk-python && uv run pytest -q
```

**To see the hub**, one command — it installs what is missing on first run:

```bash
./scripts/run-hub.sh
```

Then open **http://localhost:5100**.

> One detail worth knowing if you run the pieces by hand: the federated app is
> **built and previewed**, not started with `vite dev`. Vite's dev server does
> not emit `remoteEntry.js` — it answers that path with the SPA fallback, so the
> hub's dynamic import receives HTML and fails. `run-hub.sh` does the build for
> you; running `npm run dev` in `finance-spend-explorer/frontend` instead will
> leave the hub unable to mount it.

Sign in with tenant `finance` and any user. The directory shows two apps, and
**the compensation app is not among them** — that user does not hold
`insights:read_sensitive`, so it is absent rather than greyed out. Sign in on
tenant `people-analytics` with that scope and it appears, opening in its own
origin rather than mounting. That is
[ADR-2](docs/adr/0002-tiered-tenant-isolation.md) on screen: composition follows
authorization, and the irreversible dataset keeps a second boundary.

To use it by hand instead: `docker compose up -d` for the stubs, then run either
example app. Full walkthrough, written for a team joining on day one:
**[`ONBOARDING.md`](ONBOARDING.md)**

> The `docker compose` path is written but **unverified** — Docker was not
> available on the machine this was built on, so the Dockerfiles and compose
> file were validated by building the equivalent wheels and parsing the YAML,
> not by running them. The script above is the path that has actually been run.

---

## Map

**Six repositories**, split by what shares code rather than by who writes it.

### Published packages — what tenants install

| Repository | What | Published as |
|---|---|---|
| `insights-sdk-python` | Identity, authorization, scoped data access, telemetry, audit, job harness | Python package |
| `insights-ui-kit` | React components and design tokens, so twenty-five apps look like one product | npm package |

They version independently and share no code — the only thing crossing between
them is an HTTP contract. See [ADR-1](docs/adr/0001-reuse-upgrade-and-repository-boundaries.md).

### This repository — the paved road

| Where | What |
|---|---|
| [`docs/adr/`](docs/adr/) | The five architecture decisions. Read these first. |
| [`ONBOARDING.md`](ONBOARDING.md) | Day one for a hypothetical team #6. Written as a product doc. |
| [`tenants/`](tenants/) | One manifest per tenant — tier, the scopes its apps define, warehouse role, apps. The unit of onboarding. |
| `packages/shell/` | The hub. Composes apps the signed-in user is authorised for. |
| `stubs/` | Fakes for infrastructure we don't have: `idp/`, `warehouse/`, `auditlog/`. |
| `templates/web/`, `templates/job/` | The two scaffolds. Deliberately separate — see ADR-1. |

### Tenant apps — one repository each

| Repository | Tenant | Tier |
|---|---|---|
| `people-analytics-dashboard` | people-analytics | **restricted** — enforced scope checks, fail-closed audit, its own page |
| `finance-spend-explorer` | finance | standard — composed into the hub |
| `finance-spend-export` | finance | standard — scheduled job, service identity |

**A tenant writes application code and nothing else.** Identity, authorization,
scoped data access, telemetry and audit all arrive from the packages above. If a
team finds itself implementing authentication, that is a gap in the platform.

**Two things belong in one repository when a change has to land in both at once.** Everything the
platform team writes does not qualify; each tenant owns its
own repository because the tenant boundary is the one that genuinely needs an
independent lifecycle. Reasoning in
[ADR-1](docs/adr/0001-reuse-upgrade-and-repository-boundaries.md).

---

## The questions the brief asked

| Question | Answer lives in |
|---|---|
| How does shared behaviour reach apps, and what's the upgrade story for 12 dependent apps? | [ADR-1](docs/adr/0001-reuse-upgrade-and-repository-boundaries.md) — a library, consumed like any dependency: we publish, tenants take it when they want it. Release notes are written as *what you can now delete*, and the hub turns each app's reported SDK version into what it's missing — because the real risk is a team rebuilding something that already shipped, not a team being a version behind. Security fixes carry a deadline, and the escalation is revoking their warehouse role, never editing their code. |
| Where do platform rules live, and how did you decide? | [ADR-3](docs/adr/0003-where-platform-rules-are-enforced.md) — a rule sits at the cheapest layer where its failure is still recoverable. Three runtime gates, deliberately no more. |
| What do tenants share, and what facts drew that line? | [ADR-2](docs/adr/0002-tiered-tenant-isolation.md) — tenants are employee teams with organizational recourse, so the threat model is carelessness, not malice. That makes soft isolation correct by default and People Analytics the exception. |
| What can the platform team see and do, and how is that constrained and evidenced? | [ADR-4](docs/adr/0004-operator-access-and-break-glass.md) — metadata by default, break-glass with a second approver for raw data, audit store the platform team cannot edit. |
| What did you consciously leave out? | [ADR-5](docs/adr/0005-deliberate-omissions.md) — eight omissions, each with a trigger someone could actually check. |

One the brief didn't ask but twenty-five tenants raise on their own:
**how do twenty-five apps become one product?** —
[ADR-2](docs/adr/0002-tiered-tenant-isolation.md), where composition follows
authorization.

One question the brief didn't ask, but twenty-five tenants raise on their own:
**how do twenty-five apps become one product rather than twenty-five bookmarks?**
[ADR-2](docs/adr/0002-tiered-tenant-isolation.md) answers it, and reverses
one of ADR-5's omissions in the process — standard-tier apps federate into a
shell, restricted-tier apps deliberately do not. The superseded entry is left
visible in ADR-5 rather than deleted.

---

## The idea the whole design turns on

One question decides most of it: **can this damage be walked back?**

It splits the isolation tiers in ADR-2 — detective controls where harm is
reversible, preventive controls where it isn't. It places every enforcement rule
in ADR-3 — a rule lives at the cheapest layer where its failure is still
recoverable, which is why a secret in git history is blocked in CI (irreversible,
cheap to detect) while naming conventions are left to convention (annoying,
entirely recoverable).

One principle, applied twice, is what makes the design arguable rather than a
list of preferences.

---

## What's actually built

Honest inventory, because a submission that overstates itself is worse than one
that doesn't.

**Built and tested** — the SDK and the guarantees the ADRs claim for it. The test
suite exists specifically to prove those claims rather than to pad coverage: a
malformed token returns 401 rather than 500, a token issued for one tenant is
refused by another's app, the logger refuses collections and long strings, a
restricted-tier app fails to start if any route is unscoped, and a restricted-tier
app refuses to serve when it cannot write an audit record while a standard-tier
app buffers and continues.

```bash
cd ../insights-sdk-python && uv run pytest -q
```

**Built** — three stubs, both scaffolds, the UI kit, the hub, and three tenant
apps: a restricted-tier dashboard, a standard-tier explorer federated into the
hub, and a scheduled job. 24 tests pass across the SDK and the two tested apps;
five frontend packages build with no TypeScript errors.

The brief asks for two example apps. The third exists for one reason: the hub
needs a standard-tier remote to mount, and the only other web app is restricted
tier and deliberately cannot be mounted. Without it, ADR-2's central claim would
be untested.

**Built but unproven in a browser** — the hub's new-tab behaviour was verified
structurally (real anchors, correct `target`/`rel`, no intercepting handlers)
rather than by observing a second tab open, because the embedded browser used
during development does not spawn them.

**Designed but not built** — everything in [ADR-5](docs/adr/0005-deliberate-omissions.md),
each with the trigger that would start it.

---

## What I'd do next, in order

1. **A small service behind the hub** — two days, and the only item here that
   removes manual work rather than adding a capability.

   Every app is currently declared twice: once in `tenants/*.yaml`, which is the
   record of what a tenant is, and again in `packages/shell/src/registry/apps.ts`,
   which is what the hub renders. Nothing checks they agree. Onboarding a team
   means editing both and rebuilding the hub — a per-tenant manual step, which is
   exactly the cost [ADR-1](docs/adr/0001-reuse-upgrade-and-repository-boundaries.md)
   says breaks first as tenant count grows.

   One service reading the manifests and serving the registry makes the manifest
   the only place anything is declared, and onboarding becomes "add a file". The
   same service is the natural home for three other things the hub cannot do
   today: polling health server-side (the browser cannot reach the restricted
   app's health endpoint, correctly), storing the access grants
   [ADR-2](docs/adr/0002-tiered-tenant-isolation.md) promises owners can manage,
   and serving announcements instead of compiling them into the bundle.

   It stays off the request path — if it is down, tenant apps keep serving — so
   it does not contradict ADR-1's argument against operating services.

2. **Grant-drift detection** — one day. ADR-2's isolation guarantee rests on
   per-tenant warehouse roles that nothing currently verifies. A read-only job
   that diffs actual grants against declared tier and alerts on divergence closes
   the gap beneath the design's central claim — the only omission that silently
   invalidates something promised to a compliance partner.
3. **The hub's "what you're missing" view** — a day. ADR-1 rests on discovery
   doing the work that pushing would otherwise do, and that view is the
   mechanism. The data is already there: every app reports its SDK version on
   `/health` and the hub already polls it. Right now it just isn't saying
   anything with it, which leaves the pull model's one weakness unaddressed.
4. **Static SDK usage analysis** — two days. We promise a supported-version window
   but can't currently answer "who uses this function?", so the first deprecation
   would be guesswork. Static analysis across tenant repos is the cheap half, and
   needs no runtime component tenants could object to.

Everything else waits for the trigger written next to it in ADR-5.

---

## What I'd do differently with more time

**Prove the discovery loop rather than describe it.** ADR-1 argues that a pull
model works because the platform makes new capability *findable* — release notes
written as an offer, and the hub showing each app what it's missing. The notes
exist; the hub view doesn't yet. Wiring the reported SDK version to the release
feed would turn the ADR's load-bearing claim into something you can watch
working, and I'd trade several UI components for it.

**Exercise the restricted tier under failure.** The fail-closed audit path is
tested, but a demo where the audit sink is killed and the dashboard visibly
returns 503 while the standard-tier job keeps running would make the tier split
land in a way no document does.

**Harden the shell.** ADR-2's composition model is the newest decision here and
the least exercised. The restricted-tier path — a link card that structurally
cannot be mounted as a remote — is enforced by a single tenant's registry entry,
which makes it the branch most likely to rot. It needs its own smoke test on
every shell release, the same way the restricted backend path does.
