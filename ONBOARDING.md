# Joining the Insights Platform

Welcome. This is everything you need for day one.

You are team #6. Five teams are already here, and the things they all needed —
signing people in, reaching the warehouse, logging something an operator can
actually read, getting deployed — are solved. You should be looking at your own
data in about an hour.

If anything below is wrong or slow, tell us. Onboarding friction is our bug, not
yours.

---

## Before you start

Two things come from us, not from you:

**Your tenant ID** — a short slug like `supply-chain`. It scopes your data, tags
your telemetry, and appears in every audit record. Ask us and we'll create it.

**Your tier** — `standard` or `restricted`. We assign this based on what your data
is, and it is deliberately not self-service. Almost everyone is `standard`. You'd
be `restricted` only if you hold something where an accidental disclosure cannot
be walked back — compensation, health, anything under a compliance commitment.
If you think you might be, talk to us before you write code; the tier changes how
your app behaves and it is easier to start there than to move later.

Everything else you do yourself.

---

## Step 1 — Pick your shape

There are two paved roads. Pick the one that matches what you're building.

**An interactive web app** — someone opens it in a browser and looks at something.

```bash
cp -r insights-platform/templates/web my-app
```

**A scheduled job** — something that runs on a timer and produces output.

```bash
cp -r insights-platform/templates/job my-job
```

They share the SDK and nothing else. A job has no user sitting in front of it, so
it authenticates differently and reports different signals. Don't try to make one
template do both; if you genuinely need both, make two things.

---

## Step 2 — Run it locally

Start the platform's stubbed infrastructure — a fake identity provider, a fake
warehouse, an audit sink:

```bash
cd insights-platform && docker compose up -d
```

Point your app at your tenant and start it:

```bash
export INSIGHTS_TENANT_ID=supply-chain
export INSIGHTS_TIER=standard
export INSIGHTS_IDP_URL=http://localhost:8081
export INSIGHTS_WAREHOUSE_URL=http://localhost:8082
export INSIGHTS_AUDIT_URL=http://localhost:8083

uv run uvicorn app.main:app --reload
```

If a required variable is missing, the app refuses to start and tells you which
one. That's deliberate — a half-configured app that accepts traffic is worse than
one that doesn't start.

---

## Step 3 — Sign in

In production, authentication is corporate SSO and you don't think about it. The
SDK verifies the token and hands you a `Principal`; that's your whole involvement.

Locally, mint a token from the stub:

```bash
curl -s localhost:8081/token/user \
  -d '{"tenant_id":"supply-chain","subject":"you@company.com","scopes":["insights:read"]}' \
  -H 'Content-Type: application/json'
```

Then call your app with it:

```bash
curl localhost:8000/api/insights -H "Authorization: Bearer <token>"
```

In your routes:

```python
from insights_platform import current_principal, scoped, require_scope, READ_INSIGHTS, Depends

@app.get("/api/insights")
@scoped(READ_INSIGHTS)
async def insights(principal = Depends(current_principal)):
    require_scope(principal, READ_INSIGHTS)
    ...
```

Two things worth knowing:

- **Tokens are short-lived** — an hour for users, fifteen minutes for services.
  There is no central revocation, so a short lifetime is what bounds the damage
  if one leaks. Your frontend should handle a 401 by sending the user back to
  sign in, not by showing a blank page.
- **A token is bound to one tenant.** Yours won't work against another team's
  app, and theirs won't work against yours.

---

## Getting your people access

**You manage this yourself. No ticket, no waiting on us.**

Signing in is corporate SSO — that part is handled and you never think about it.
What someone can *do* once they're in is yours to decide.

**Declare your scopes.** In your tenant manifest, list the permissions your app
defines and what each one unlocks:

```yaml
scopes:
  insights:read:      "See the shipments dashboard"
  insights:export:    "Download the full extract"
```

Write the descriptions for a human. The person granting them is a team lead
deciding whether a colleague should have it, not an engineer reading your code.

**Grant them.** As the app owner you add and remove people directly, and it takes
effect immediately. We mint tokens carrying exactly what you granted, and the
platform enforces it on every request — your app doesn't have to.

> **Not built yet.** Enforcement is real; the granting surface is not. Today the
> development identity provider issues whatever scopes you ask it for, which is
> enough to exercise your app's behaviour locally. Ask us and we'll set real
> grants up by hand until the self-service surface exists.

**Everything is recorded.** Grants, revocations and the data accesses that follow
all land in the same audit log. When someone asks "who gave them access, and what
did they look at", that's one question with one answer, not a reconciliation
between two systems.

**Two things aren't yours to set:**

- **Your tier** — we assign it, because it carries compliance obligations you
  can't waive on the organisation's behalf.
- **Restricted-tier scopes** — if a scope unlocks confidential data, your data
  owner approves the grant as well as you. Two people, by design.

**There are no roles**, only scopes. If you find yourself wanting three or more
named bundles, tell us — that's the signal it belongs in the platform rather than
in your app, and we've written down that we'd build it at that point.

---

## Step 4 — Reach your data

You get a scoped client. You don't configure a connection, and you don't pass a
tenant ID:

```python
rows = await platform.warehouse.fetch(principal, "shipments")
```

The tenant scope is injected by the client. There is no parameter through which
you could ask for someone else's rows, and the warehouse role your app connects
with wouldn't return them if you did.

Need a dataset you can't see? Ask us. Access is granted per tenant, and we'd
rather grant it properly than have you copy a CSV into your repo.

There's a REST connector too, for internal APIs registered as shared connections:

```python
payload = await platform.rest.fetch(principal, "org-chart")
```

---

## Step 5 — Logging, and the one rule

Use the platform logger. Everything you log is automatically tagged with your
tenant and the acting principal, which is what makes it findable later:

```python
from insights_platform import get_logger
log = get_logger("shipments")

log.info("Fetched shipments.", dataset="shipments", row_count=len(rows))
```

**The rule: no payloads in logs.** The logger accepts scalar fields and refuses
lists, dicts, and long strings — it will raise rather than let them through.

This catches a specific, extremely common accident: an exception handler that
logs the rows it was working on, quietly putting real data somewhere every
operator can read it. Log a count, log an ID, log a dataset name. If you need to
show us actual data to debug something, generate a scrubbed sample and send it
deliberately — see "What we can see" below.

---

## Step 6 — Deploy

Your template includes a Dockerfile that runs as a non-root user, and a CI
workflow that runs before anything merges. The checks are:

- **No secrets in the diff.** A credential in git history isn't removable in
  practice; it has to be rotated. So we block it rather than detect it.
- **You're on a supported SDK version** — current major or the one before.
- **Your health endpoint answers correctly.** Our operator view depends on all
  apps reporting the same shape.
- **Your tests pass.** Not a platform rule so much as what makes an SDK upgrade
  something you can take with confidence rather than dread.

`--no-verify` exists and we're not removing it. If you're mid-incident at 2am,
you need an escape hatch. It's recorded, and nobody will ask you about it unless
it becomes a habit.

---

## Step 7 — Know it's healthy

Every app answers `/health` with the same contract:

```json
{"status":"ok","tenant_id":"supply-chain","tier":"standard","sdk_version":"0.1.0"}
```

It also reports `audit_buffered`. If that number is climbing, the audit sink is
unreachable and events are queuing locally — worth a message to us, not an
emergency.

Your telemetry is queryable by tenant. You see everything for your own app:
requests, durations, error classes, and the audit trail of which datasets were
read by whom.

For a scheduled job the signals that matter are different — did it run, how long
did it take, has it silently stopped running. `jobs.run()` emits those for you.

---

## Upgrades: what we do, what you do

**You upgrade when it suits you.** The SDK works like any dependency you already
use: we publish a release, the notes say what's in it, you take it when you want
it. We don't open pull requests in your repo and we don't merge in it.

**Read the release notes as an offer, not a changelog.** Each entry is written to
answer one question — *what can you now delete from your own code?* The thing
we'd most like to prevent is you spending a fortnight building something that
shipped in the SDK last month.

**The hub tells you what you're missing.** Your app reports its SDK version on
`/health`; the hub compares that against current and shows your team the
capabilities sitting in the versions between. You shouldn't have to watch a feed
to find out something now exists.

**We support the current major version and the one before.** Further back than
that and we'll help you upgrade, but we won't debug your app until you have.

**You always merge.** We never push into your repository, including for security
fixes. We can confirm the SDK still works; only you can confirm your numbers are
still right, and a change that satisfies us and quietly breaks your
reconciliation is worse than an unpatched library.

**Security fixes come with a deadline.** The PR arrives with a severity, what the
exposure actually is, and a date. If that date passes with the app unpatched, we
revoke your warehouse role until it's merged — your app stops reading data rather
than carrying a known hole.

That's a real outage and we don't do it casually; the deadline is set so nobody
reaches it by accident. But the escalation is deliberately your *access*, not
your code. We'd rather stop your app than silently change what it calculates.

---

## What we can see

You should know this rather than discover it.

**By default we see metadata, never your data.** Request paths, durations, error
classes, health, and the audit trail of which dataset was read by which
principal. We do not see rows. The logger's no-payload rule is a large part of
what keeps that true.

**If we need to see actual data, we ask.** It's time-boxed to an hour, it needs
a second approver, and the whole thing is recorded. If you're on the restricted
tier, the second approver is *your* data owner — not someone on our team.

**The audit log is not ours to edit.** It's append-only and operated by a
different team, specifically so that the people being recorded aren't the people
administering the recording. If you're on the restricted tier, your compliance
partner has a standing read on it and doesn't need to come through us.

What we cannot honestly claim: that it is *impossible* for us to read your data.
We hold infrastructure access; anyone who tells you otherwise is describing a
system they don't operate. What we have built is a setup where the normal path is
narrow and the exception is loud, approved, and permanently recorded.

---

## When something breaks

**App won't start, complains about `INSIGHTS_TENANT_ID`** — environment variables
aren't set. See step 2.

**App won't start, "unscoped routes"** — you're on the restricted tier and a route
has no `@scoped(...)`. Add one, or `@scoped(PUBLIC)` if it's deliberately open.

**Everything returns 401** — most likely an expired token; they last an hour.
Check also that the token's tenant matches your app's.

**Everything returns 503 and the logs say audit unavailable** — you're on the
restricted tier and the audit sink is down. This is deliberate: we'd rather your
app stop than serve compensation data it can't record access to. Tell us and
we'll get the sink back.

**The logger raised `PayloadInTelemetryError`** — you tried to log a collection or
a long string. See step 5. The error message names the field.

**Something else** — come and find us. We'd rather answer the same question five
times than have five teams each invent a different workaround.
