# Tenant spaces

The platform has two zones.

**Shared services** — everything the platform team builds, owns, and operates:
the SDK, the UI kit, the shell, and the stubbed identity, warehouse, and audit
services. One repository, released together (ADR-1).

**Tenant spaces** — one per consuming team. Each team gets its own repository,
its own deployment, its own warehouse role, and the scopes its apps define. They
write application code and nothing else: identity, authorization, scoped data
access, telemetry, and audit all arrive from the shared layer.

A tenant never implements security. If a team finds themselves writing
authentication, they have found a gap in the platform — tell us.

## What a space is

This directory holds one manifest per tenant. The manifest is the single
declaration of what that space contains, and it is the thing the platform team
edits when a team joins.

```
tenants/
  people-analytics.yaml
  finance.yaml
```

Each manifest declares:

| Field | Meaning |
| --- | --- |
| `tenant_id` | the scope on every token, log line, audit record, and warehouse query |
| `tier` | `standard` or `restricted` — assigned here, never self-selected (ADR-2) |
| `origin` | the host the tenant's apps are served from |
| `scopes` | the permissions this tenant's apps define, and which need a second approver |
| `warehouse_role` | the database role that backstops data scoping |
| `apps` | each app, its kind, and how the shell integrates it |

## Why one file per tenant

Onboarding a team has to stay cheap, because the thing that breaks at
twenty-five tenants is platform-team effort per tenant, not load (ADR-1). A
manifest makes the whole provisioning step reviewable in a pull request: the
tier, the groups, the role, and the integration mode are all visible in one
diff, and a compliance partner can read a tenant's entire posture without
reading any code.

It also puts the restricted-tier decisions where they cannot be made by
accident. `tier: restricted` and a dedicated `origin` sit next to each other in
the same file, which is what makes the ADR-2 composition rule structural rather
than conventional — a restricted app has no `remote_url` to give the shell.

## What this does not do yet

**Nothing reads these files.** The hub renders its directory from
`packages/shell/src/registry/apps.ts`, a TypeScript module compiled into its
bundle, which mirrors these manifests by hand. Adding a tenant means editing
both and rebuilding the hub — a per-tenant manual step, and precisely the cost
ADR-1 says breaks first as tenant count grows.

A small service reading these manifests and serving the registry is the top item
in the root README's "what I'd do next", because it turns onboarding into
"add a file" and removes the only place two documents can silently disagree.

**Nor do they provision anything.** The warehouse role and the repository are
both created by hand. A manifest records intent and makes drift reviewable; it
does not prevent drift.

That gap is ADR-5 item 2, and it is named there as the weakest point in the
design — the isolation guarantee in ADR-2 rests on warehouse grants that no
automated process verifies. The first thing worth building is not a provisioner
but a checker: a read-only job that diffs actual grants against what these files
declare, and alerts on divergence. Roughly a day, and it closes the gap beneath
the design's central claim.
