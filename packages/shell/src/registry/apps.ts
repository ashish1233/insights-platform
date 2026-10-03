/**
 * The app registry — the shell's single source of truth about what exists and
 * how it may be composed.
 *
 * In production this is projected from the tenant manifests in
 * `insights-platform/tenants/*.yaml` and served by the platform
 * (`GET /registry/apps`), for the same reason tier itself is platform
 * configuration in ADR-2: an app must not be able to assert its own tier. A
 * static module is the stand-in here, and the shape below mirrors the manifests
 * field for field, so swapping a `fetch` in later is a one-file change.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * THE TIER RULE, AND WHY IT IS A TYPE
 *
 * ADR-2: standard-tier apps are federated into the shell; restricted-tier apps
 * are not, because Module Federation puts every remote in one origin and one
 * JavaScript realm with no enforcement boundary between them.
 *
 * That rule is enforced here structurally, not by convention, at three levels:
 *
 *   1. `RestrictedApp` declares `remoteUrl?: never`. A registry entry marked
 *      restricted cannot carry a remote URL — it is a compile error to write
 *      one, so there is no value the shell could pass to the federation loader
 *      even if someone tried.
 *   2. `REMOTE_LOADERS` in `../federation/remotes.ts` is keyed by
 *      `StandardAppId`, a type derived from this file. A restricted app's id is
 *      not assignable to that key, so a loader cannot be registered for one.
 *   3. `vite.config.ts` builds its federation `remotes` map from this registry
 *      by filtering on tier. A restricted app therefore has no remote container
 *      in the shell's bundle at all — the enforcement survives into the
 *      artefact, not just the source.
 */

/** Mirrors `TenantTier` in the ui-kit. Duplicated so this module stays
 *  dependency-free: `vite.config.ts` imports it at config-load time. */
export type AppTier = 'standard' | 'restricted';

/** Matches `kind:` in the tenant manifests. */
export type AppKind = 'web' | 'job';

interface RegistryEntryBase {
  /** Stable id. Also the shell's route segment: `#/app/<id>`. */
  id: string;
  /**
   * The scope a user must hold for this app to appear at all, copied from
   * `required_scope:` in the tenant manifest.
   *
   * This is what makes composing apps into one page safe (ADR-2): the hub
   * renders only what the signed-in user is authorised for, so a page never
   * contains an app its viewer could not already open directly. Filtering here
   * is presentation, not enforcement — the app's own backend refuses the call
   * regardless — but it is what keeps the shared page honest.
   */
  requiredScope: string;
  name: string;
  description: string;
  tenant: string;
  /** The repository that owns it — one per tenant app, per ADR-1. */
  repo: string;
  /**
   * The app's path on the shell's own origin, copied from `route:` in the
   * tenant manifest.
   *
   * Every entry has one, including restricted apps and jobs, and that is the
   * point: it is the stable, linkable, pasteable address of the app *within the
   * platform*. What it renders differs by tier — a mounted remote, a link card,
   * a job summary — but a user who sends a colleague a URL should not have to
   * know which.
   */
  route: string;
  /**
   * Full URL of the app's `/health` document (the contract in
   * `templates/web/backend`). The shell polls it and cross-checks the tier the
   * backend reports against the tier recorded here — a disagreement means a
   * tenant believed to be restricted may be running without its gates, which
   * is worth interrupting someone over.
   *
   * Polling this *from the browser* works for standard-tier apps and not for
   * restricted ones, and that is correct rather than a gap. A restricted app's
   * backend does not list the hub's origin in its CORS allowlist, so the hub
   * cannot read anything from it — including this. Widening the allowlist for
   * `/health` is not available either: CORS is configured per application, not
   * per route, so it would also hand the hub's realm the restricted
   * `/api/insights`, which is the exact thing ADR-2 refuses.
   *
   * The production answer is that the platform polls health server-side and
   * serves it alongside the registry, where there is no origin to be on the
   * wrong side of. Until then the shell reports what a browser can actually
   * see, and says so, rather than showing a green tick it did not earn.
   */
  healthUrl: string;
}

/** Federated. Mounts inside the shell, shares its origin and its session. */
export interface StandardApp extends RegistryEntryBase {
  kind: 'web';
  tier: 'standard';
  /** Module Federation container name. Must match the remote's `federation.name`. */
  remoteName: string;
  /** URL of the remote entry chunk. */
  remoteUrl: string;
  /** The exposed module key, e.g. `./SpendExplorer`. */
  remoteModule: string;
  /**
   * Where the app also runs on its own. ADR-2 makes this non-optional for every
   * app: the shell is on the critical path of everyone's UX, so a tenant has to
   * be able to route around it during an incident.
   */
  standaloneUrl: string;
  href?: never;
  schedule?: never;
}

/**
 * Not federated. Appears in the shell as a link card and opens in its own
 * origin, which is the only preventive boundary a browser offers.
 */
export interface RestrictedApp extends RegistryEntryBase {
  kind: 'web';
  tier: 'restricted';
  /** The app's own origin. For a restricted app this is the *only* way in. */
  href: string;
  remoteName?: never;
  remoteUrl?: never;
  remoteModule?: never;
  standaloneUrl?: never;
  schedule?: never;
}

/** A completed run of a scheduled job, as the platform's job harness reports it. */
export interface JobRun {
  /** ISO-8601. */
  finishedAt: string;
  outcome: 'succeeded' | 'failed';
  durationSeconds: number;
  rowsExported: number;
}

/**
 * A scheduled job. No UI, no origin, and nothing to mount — ever.
 *
 * The tenant manifests say jobs "never appear in the shell", meaning they are
 * never something a user opens. They do appear in the *directory*, because the
 * directory is an inventory of what runs on the platform and a list that
 * silently drops every batch job misrepresents the platform to the person
 * reading it. The card has no open action, which is the honest rendering of
 * both facts at once.
 */
export interface ScheduledJob extends RegistryEntryBase {
  kind: 'job';
  tier: AppTier;
  /** Cron expression, copied from the tenant manifest. */
  schedule: string;
  /** Human reading of `schedule`, so nobody has to parse cron in a card. */
  scheduleLabel: string;
  /** The service identity it runs as. Never a borrowed user token (ADR-1). */
  servicePrincipal: string;
  /**
   * PLACEHOLDER DATA. The job harness does not yet publish run history
   * anywhere the shell can read, so this is a fixed fabricated run and is
   * labelled as such in the UI. It is here to settle the layout question —
   * what a run summary occupies — not to look live. Replace with
   * `GET /registry/jobs/<id>/runs?limit=1` when the harness exposes it.
   */
  lastRun: JobRun | null;
  remoteName?: never;
  remoteUrl?: never;
  remoteModule?: never;
  standaloneUrl?: never;
  href?: never;
}

export type RegisteredApp = StandardApp | RestrictedApp | ScheduledJob;

const REGISTRY = [
  {
    id: 'finance-spend-explorer',
    requiredScope: 'insights:read',
    name: 'Spend Explorer',
    description: 'Spend by cost centre and period.',
    tenant: 'finance',
    repo: 'finance-spend-explorer',
    route: '/apps/spend-explorer',
    kind: 'web',
    tier: 'standard',
    healthUrl: 'http://localhost:5174/health',
    standaloneUrl: 'http://localhost:5174/',
    remoteName: 'finance_spend_explorer',
    remoteUrl: 'http://localhost:5174/assets/remoteEntry.js',
    remoteModule: './SpendExplorer',
  },
  {
    id: 'finance-spend-export',
    requiredScope: 'insights:read',
    name: 'Spend Export',
    description: 'Nightly spend extract to the finance data drop.',
    tenant: 'finance',
    repo: 'finance-spend-export',
    route: '/jobs/spend-export',
    kind: 'job',
    tier: 'standard',
    healthUrl: 'http://localhost:8090/health',
    schedule: '0 2 * * *',
    scheduleLabel: 'Daily at 02:00 UTC',
    servicePrincipal: 'spend-export',
    lastRun: {
      finishedAt: '2026-10-03T02:04:11Z',
      outcome: 'succeeded',
      durationSeconds: 251,
      rowsExported: 48211,
    },
  },
  {
    id: 'people-analytics-dashboard',
    requiredScope: 'insights:read_sensitive',
    name: 'Compensation Insights',
    description: 'Compensation reporting. Opens in its own origin.',
    tenant: 'people-analytics',
    repo: 'people-analytics-dashboard',
    route: '/apps/compensation-insights',
    kind: 'web',
    tier: 'restricted',
    healthUrl: 'http://localhost:8000/health',
    href: 'http://localhost:5173/',
    // No `remoteUrl`, and no way to add one: see RestrictedApp above.
  },
] as const satisfies readonly RegisteredApp[];

export const APPS: readonly RegisteredApp[] = REGISTRY;

/**
 * The apps a given set of scopes may see.
 *
 * ADR-2 argues that composing tenant apps into one page is safe because the
 * page only ever contains what its viewer is already entitled to open. That
 * argument is only true if something actually filters — this is it.
 *
 * Presentation only. The app's own backend enforces the same scope on every
 * request and would refuse a caller who reached it another way; hiding a card
 * is a courtesy, not a control.
 */
export function visibleTo(scopes: readonly string[]): RegisteredApp[] {
  return REGISTRY.filter((app) => scopes.includes(app.requiredScope));
}

export type AppId = (typeof REGISTRY)[number]['id'];

/** The ids a federation loader may be registered for. Neither a restricted app
 *  nor a job is a member of this type, which is what makes rule (2) above a
 *  compile error rather than a code-review catch. */
export type StandardAppId = Extract<
  (typeof REGISTRY)[number],
  { tier: 'standard'; kind: 'web' }
>['id'];

/**
 * The only way the shell ever decides something is mountable.
 *
 * It checks the kind, the tier, *and* the presence of a remote URL. The last
 * check is redundant against the type system and kept anyway: when this
 * registry starts arriving over HTTP the types stop being a guarantee about the
 * data, and this is the line that still holds.
 */
export function isFederated(app: RegisteredApp): app is StandardApp {
  return (
    app.kind === 'web' &&
    app.tier === 'standard' &&
    typeof (app as StandardApp).remoteUrl === 'string'
  );
}

/** Opens in its own origin — the restricted-tier composition mode. */
export function isLinkedOut(app: RegisteredApp): app is RestrictedApp {
  return app.kind === 'web' && app.tier === 'restricted';
}

export function isJob(app: RegisteredApp): app is ScheduledJob {
  return app.kind === 'job';
}

/**
 * Whether a browser sitting on the hub's origin can read this app's `/health`.
 *
 * Only a standard-tier web app can. The other two cases are not gaps:
 *
 *   - A **restricted** app's backend does not list the hub among its allowed
 *     origins, and widening that allowlist is not available — CORS is
 *     configured per application rather than per route, so letting the hub read
 *     `/health` would also hand it the restricted `/api/insights`, which is the
 *     exact thing ADR-2 refuses.
 *   - A **job** has no browser-facing server to answer. `healthUrl` points at
 *     the harness, which speaks to the platform and to nothing else.
 *
 * The shell uses this to decide what to *ask*, not how to *render*. A health
 * check the hub was never going to get an answer to must not be reported as a
 * failure, because a warning that includes a designed-in condition teaches
 * people to ignore warnings — and the restricted app is the one entry on this
 * page where a genuine alarm matters most.
 *
 * The production fix for both is the same and is not a wider allowlist: the
 * platform polls health server-side, where there is no origin to be on the
 * wrong side of, and serves it alongside the registry. `healthUrl` stays on
 * every entry so that becoming a change of *caller* rather than of shape.
 */
export function healthIsBrowserReadable(app: RegisteredApp): boolean {
  return app.kind === 'web' && app.tier === 'standard';
}

export function findApp(id: string): RegisteredApp | undefined {
  return APPS.find((app) => app.id === id);
}

/** Distinct tenants, in registry order. */
export function tenants(): string[] {
  return Array.from(new Set(APPS.map((app) => app.tenant)));
}

export function appsForTenant(tenant: string): RegisteredApp[] {
  return APPS.filter((app) => app.tenant === tenant);
}

/**
 * Substring search across the three things someone actually remembers about an
 * app: what it is called, whose it is, and whether it is a job.
 *
 * Deliberately not fuzzy. A fuzzy matcher over twenty-five short names returns
 * everything for most queries and is impossible to reason about when it returns
 * the wrong thing; the failure mode of substring matching is "no results", which
 * a user understands immediately and corrects themselves.
 */
export function matchesQuery(app: RegisteredApp, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;

  const haystack = [
    app.name,
    app.tenant,
    app.description,
    app.kind === 'job' ? 'job scheduled' : 'app',
    app.tier,
  ]
    .join(' ')
    .toLowerCase();

  // Every whitespace-separated term must match, so "finance job" narrows
  // rather than widening the way a naive OR would.
  return needle.split(/\s+/).every((term) => haystack.includes(term));
}

/**
 * The `remotes` map for `vite.config.ts`, derived from the registry rather than
 * hand-maintained alongside it. Two lists that must agree is how a restricted
 * app eventually ends up with a remote container nobody noticed.
 */
export function federationRemotes(): Record<string, string> {
  return Object.fromEntries(
    APPS.filter(isFederated).map((app) => [app.remoteName, app.remoteUrl]),
  );
}
