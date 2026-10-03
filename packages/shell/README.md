# Insights Hub shell

The micro-frontend host. It is what turns twenty-five apps into one product
instead of twenty-five bookmarks.

Decision and reasoning: [ADR-2](../../docs/adr/0002-tiered-tenant-isolation.md).
This file is how it is built.

---

## The rule it exists to enforce

**Standard-tier apps are federated. Restricted-tier apps are not.**

Module Federation puts every remote in one browser origin and one JavaScript
realm. A standard-tier app mounted next to the People Analytics dashboard could
read its rendered confidential figures out of the DOM with ordinary JavaScript. The
backend tolerates soft isolation because a warehouse role is the backstop; the
browser has no equivalent, so for data whose disclosure cannot be walked back
the only preventive control is a separate origin.

The shell enforces this **structurally**, in three places, so that it is not a
convention anyone can forget:

| # | Where | What stops you |
|---|---|---|
| 1 | `src/registry/apps.ts` | `RestrictedApp` declares `remoteUrl?: never`. Writing a remote URL on a restricted entry is a compile error, so there is no value to hand the loader. |
| 2 | `src/federation/remotes.ts` | `REMOTE_LOADERS` is `Record<StandardAppId, …>`, a key type derived from the registry. A restricted app's id is not assignable; registering a loader for one does not compile. The `Record` is also total, so a standard app without a loader fails the build rather than 404-ing at runtime. |
| 3 | `vite.config.ts` | The federation `remotes` map is generated from the registry by filtering on tier. A restricted app has **no remote container in the shipped bundle at all** — the rule survives into the artefact, not just the source. |

Verify (3) yourself after a build:

```bash
npm run build && grep -A3 'remotesMap = {' dist/assets/*.js
```

Exactly one entry, the standard-tier one.

`AppPage` then narrows once through `isFederated()`; `RemoteOutlet` accepts
only a `StandardApp` and `RestrictedLinkCard` only a `RestrictedApp`, so the
two render paths are disjoint at the type level rather than separated by an
`if` a later edit could invert.

---

## Run it

The shell needs the remote to be built and served first — federation loads
`remoteEntry.js` over HTTP, so there has to be an HTTP server with it on.

```bash
# 1. identity stub (from insights-platform/)
docker compose up -d idp

# 2. the standard-tier remote, built and served on :5174
cd ../../../finance-spend-explorer/frontend && npm run serve

# 3. the shell on :5100
cd ../../insights-platform/packages/shell && npm run serve
```

Then <http://localhost:5100>, and sign in as any user on tenant `finance`.

`npm run dev` works for shell-only work, but the remote still has to be built
and served — Vite's dev server does not produce a remote entry.

---

## React is shared, and the plugin does not have a `singleton` flag

`@originjs/vite-plugin-federation` **does not implement** webpack's
`singleton: true`. It is commented out in the plugin's own type definitions and
the string does not appear anywhere in its runtime. Passing it is a type error,
not a no-op, which is at least loud.

What it implements instead: the host writes its shared copies into
`globalThis.__federation_shared__[scope]` when it initialises a remote
container, and each remote's `importShared()` checks that scope **first**,
falling back to the copy bundled beside it only if nothing there satisfies
`requiredVersion`.

So a single React instance is a *consequence* of the host declaring `shared`
and the remote's range matching — not of a flag asking for one. Widen the range
and a mismatched React is used anyway; narrow it past the host's version and the
remote silently loads a second React. **Both builds stay green either way**, and
the only symptom is a blank panel with "Invalid hook call".

Which is why the shell measures it rather than trusting it. `src/platform/reactIdentity.ts`
has the host and every remote announce themselves at module scope, keyed on
React's internal dispatcher holder — the exact object whose identity decides
whether hooks work. `FederationDiagnostics` renders the count at the bottom of
every page:

> React singleton OK — 1 React instance (v18.3.1) shared by 2 participants: `shell`, `finance-spend-explorer`

Anything other than 1 is a defect, and the error boundary in `RemoteOutlet`
names this cause specifically when a remote throws a hook error.

That file is duplicated into the shell and each remote on purpose. A diagnostic
that depends on the shared package cannot diagnose a problem with the shared
package.

---

## Styling across the boundary

The shell imports `@insights-platform/ui-kit/styles.css` once, in `main.tsx`.
Remotes do not ship their own copy: they build against the same published kit,
whose class names are already literal strings in its bundle, so a remote's
markup matches the stylesheet the host loaded.

This matters because the federation plugin does **not** load an exposed
module's CSS — the generated `dynamicLoadingCss([], …)` call in the remote entry
is empty. A remote that drew its own styles would render unstyled inside the
shell. Keeping remotes to ui-kit components sidesteps that entirely, and is
also the reason a remote should expose page *content* and never page chrome.

---

## Health, and what a browser can honestly report

Each registry entry has a `healthUrl`, and the shell cross-checks the tier the
backend reports against the tier the registry records — a disagreement means an
app believed to be restricted may be running without its gates, and shows as a
red `Tier mismatch` rather than a status dot.

Two endpoints the shell deliberately **cannot** read, and does not pretend to:

- **The restricted app's `/health`.** Its backend does not list the hub's origin
  in its CORS allowlist. Widening it is not available either — CORS is
  configured per application, not per route, so it would also hand the hub's
  realm the restricted `/api/insights`, which is the thing ADR-2 refuses.
- **The warehouse and the audit sink.** They are reached by tenant *backends*
  and have no browser-facing origin at all, which is correct: a warehouse that
  answers a browser is one XSS away from answering an attacker. The shell does
  not poll them; it shows a clearly-labelled `platform-reported` status.

Both want the same fix: the platform polls health server-side and serves it
beside the registry, where there is no origin to be on the wrong side of.
`healthUrl` is kept on every entry so that becomes a change of caller, not of
shape.

---

## Layout

| Path | What |
|---|---|
| `src/registry/apps.ts` | The registry and the tier types. Mirrors `insights-platform/tenants/*.yaml`. |
| `src/registry/services.ts` | The three shared services, and which of them a browser can read. |
| `src/registry/releases.ts` | The changelog feed. Authored placeholder content. |
| `src/federation/` | The loader table and the ambient declarations for the virtual remote modules. |
| `src/pages/HomePage.tsx` | The landing page. Reading order is the design — see the comment. |
| `src/components/` | Shell chrome. Every visible component comes from the ui-kit; these arrange them. |
| `src/platform/reactIdentity.ts` | The runtime singleton probe. Duplicated in each remote. |
| `src/shell.css` | Layout only — grids and the restricted-card treatment. No components. |

New reusable pieces go in the ui-kit, not here. `StatTile` was added there for
this page's status strip, because "a number with a label and a status beside it"
is the shape every reporting app ends up drawing.

---

## Known fragile

- **`src/federation/remote-modules.d.ts` must not be named `remotes.d.ts`.**
  TypeScript treats `X.d.ts` beside `X.ts` as that file's generated
  declarations and ignores it, so the ambient module would silently not exist
  and every federated import would be `any`.
- **Registry URLs are hardcoded to localhost ports.** They come from the
  platform in production; the static module says so.
- **`PLATFORM_SDK_VERSION` duplicates `sdk-python/pyproject.toml`** and will go
  stale. It belongs in the registry response.
- **One remote's bad deploy can break the shell's page.** The error boundary
  contains it to one panel, and every app stays reachable at its own URL. That
  second property is not optional — it is the condition ADR-2 accepted the
  shell's critical-path risk on.
