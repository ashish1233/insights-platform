# ADR-6: How the platform grows beyond what the platform team builds

**Status:** Accepted · **Date:** 2026-10-03

> **In short.** Three engineers cannot build every capability twenty-five teams
> will want, and letting each team build their own recreates the duplication the
> platform exists to end. So the SDK has **explicit extension points**, anything a
> tenant builds starts in their own repository, and it is promoted into the
> platform only when a **second tenant needs it** — the same "two independent
> occurrences" trigger ADR-5 uses elsewhere. One invariant holds regardless of who
> wrote the code: **anything that reads tenant data goes through the scoped client
> and the audit path.** That is the line, and it is not negotiable.

## Context

The five decisions so far describe a platform that three people can build and
operate. None of them answers the question that arrives in month four: **a team
wants something the platform does not provide.**

A warehouse connector for a source we do not support. A different export format.
Natural-language querying over their dataset. An agent that reads from the
warehouse on a schedule. Something nobody has thought of yet.

There are only three places that capability can come from, and all three are bad
in different ways:

- **The platform team builds it.** Does not scale past a handful of requests, and
  every one is a permanent maintenance obligation for three people.
- **Each team builds their own.** Recreates exactly the duplication the platform
  exists to end — five teams writing five slightly different exporters.
- **Teams contribute to the platform.** Scales, but means code twenty-five apps
  depend on is written by people who do not carry the pager for it, reviewed by a
  team that does not have review capacity (ADR-3).

## Decision

### The SDK has extension points, and they are the supported way to add things

`DataClient` is an abstract base class on purpose. A tenant that needs a source
we do not provide subclasses it rather than forking the SDK or going around it.
The same applies to job steps and output sinks.

**What an extension point obliges the extender to keep:** the scoped fetch and
the audit call. Those are not conveniences — they are what ADR-2's isolation and
ADR-4's operator model rest on. An extension that bypasses them is not an
extension, it is a hole.

### Three places code can live, and what each gets

| | Who writes it | Who supports it | Who may depend on it |
|---|---|---|---|
| **Platform core** | platform team | platform team | everyone |
| **Contributed** | a tenant | platform team, after promotion | everyone |
| **Tenant-local** | a tenant | that tenant | that tenant only |

**Everything starts tenant-local.** Build it in your own repository, against the
extension points, supported by you. No review, no gate, no waiting on us.

**Promotion happens when a second tenant needs the same thing** — not when the
author thinks it is generally useful. One team wanting something is a local
need; two teams wanting it independently is evidence of a platform gap, and
evidence is what should move code across that line.

**Promotion costs the contributor something:** tests, a documented interface, and
agreement that the platform team may change it. Promotion costs us a permanent
maintenance obligation, so the bar is deliberately higher than "it works".

**Contributed code that stops being used gets removed**, not quietly carried. The
same support window as the SDK: current major and the one before.

### The invariant, which holds for all three

**Anything that reads tenant data does so through the scoped client and produces
an audit record.** Platform-written, contributed, or tenant-local — no exception,
no "just this once", no separate path for a tool that seems harmless.

This is the only rule in this ADR that is not negotiable, and it is why the
extension points are shaped the way they are: the obligation is structural
rather than documented, because a documented obligation is one a contributor can
politely ignore.

### What this means for capabilities we have not been asked for yet

We expect requests for things this exercise did not contemplate — conversational
querying over a dataset, an agent that reads the warehouse on a schedule,
workflow orchestration between apps. We have not designed for any of them
specifically and should not: designing for a capability nobody has asked for is
how platforms acquire surface nobody uses.

But we do know what any of them must satisfy, and it is worth stating now rather
than during the negotiation:

- it reads through the scoped client, so it cannot see across tenants;
- it holds a **service identity** with its own scopes, not a borrowed user's
  token — an agent acting "as" a person corrupts the audit trail ADR-4 depends
  on, and "the agent did it" is not an answer a compliance partner accepts;
- its reads are audited like any other, with the same fail-closed behaviour on
  the restricted tier;
- it is tenant-local until a second tenant wants it.

An agent reading compensation data is not a new category of problem. It is a
service principal with scopes, and the existing controls either hold for it or
they were never holding.

## Alternatives considered

| Option | Why not |
|---|---|
| Platform team builds every requested capability | The obvious answer and the one that kills small platform teams. Every accepted request is permanent, and the queue only grows |
| Let tenants fork the SDK | Fast for them, and it ends the platform — twelve divergent copies, no upgrade path, and ADR-1's whole model gone |
| Open contribution with review | Tempting, and it is what large platforms do. Rejected because ADR-3 already concluded three engineers cannot review twenty-five teams' code; a contribution queue is the same bottleneck wearing a different hat |
| Promote on the author's say-so | Faster than waiting for a second tenant, and it fills the platform with one-team abstractions that nobody else fits. The second tenant is the cheapest available evidence that a thing is general |
| Decide the agent/AI story now | Designing for an unasked capability produces surface nobody uses. Stating the invariant costs nothing and survives whatever actually gets asked for |

## Consequences

- **Duplication is permitted, briefly, on purpose.** Two teams may build the same
  thing before we notice. That is cheaper than reviewing every idea, and the
  second instance is the signal we act on.
- **Tenant-local code gets no support.** A team that builds something clever and
  then loses the person who wrote it has a problem we will help with but do not
  own. This should be said during onboarding, not discovered.
- **Promotion is a negotiation**, and some will be refused. "Two tenants want it"
  is necessary, not sufficient — we still have to be willing to carry it.
- **The invariant needs enforcing, not just stating.** Today the extension points
  make the scoped fetch and audit call the path of least resistance, but a
  determined contributor can still write their own HTTP client. That gap is real
  and currently unaddressed.
- **We have no contribution process yet** — no CONTRIBUTING, no promotion
  checklist, no owner. Correct for two tenants and the first thing to write when
  a second team asks to promote something.

## Revisit when

- **A second tenant asks to promote the same capability** — that is the model
  working, and the moment to write the promotion process down rather than
  improvise it.
- **Three or more contributed components exist.** The platform team is now
  maintaining other people's code at a scale that needs an owner per component.
- **A tenant-local extension is found bypassing the scoped client.** The
  invariant is being honoured by convention, not structure, and needs a runtime
  check — which would be a fourth gate and would have to argue against ADR-3.
- **A capability arrives that genuinely cannot satisfy the invariant** — a tool
  that needs cross-tenant reads, say. That is not an extension question, it is a
  request to change ADR-2, and should be handled as one.
