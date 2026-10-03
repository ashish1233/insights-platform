/**
 * Platform announcements — the platform team's one channel to its tenants.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * WHY THIS EXISTS
 *
 * Three engineers support twenty-five teams. The thing that scales worst in
 * that ratio is not code, it is *telling people*: a migration window, a dataset
 * that has landed, why last Tuesday was slow. Without a channel, each of those
 * becomes twenty-five conversations, and a platform that never says anything
 * reads as one nobody is looking after — which is the point at which teams
 * start building their own.
 *
 * It is separate from `releases.ts` on purpose, and the split is editorial
 * rather than technical. A release entry answers "what changed in a thing I
 * build against, and what must I change in response" — it is reference
 * material, and it belongs in the side column where an owner goes looking for
 * it. An announcement answers "what is happening to the platform this month" —
 * it is news, it expires, and it has to be in front of someone who was not
 * looking for it.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * AUTHORSHIP — DOCUMENTED, NOT BUILT
 *
 * In production these are served from the platform registry
 * (`GET /registry/announcements`) and authored by platform operators through
 * the operator tooling, not by tenants. The shell only ever reads them.
 *
 * That is deliberately **operator capability, not tenant RBAC**, and the
 * distinction matters because ADR-2 is explicit that the platform models no
 * roles *within* a tenant — a tenant is the unit of isolation, and inventing a
 * "tenant admin" role would make the platform the arbiter of a tenant's
 * internal org chart, which is a product the platform team cannot staff. None
 * of that is in tension with a publish path here, because platform staff are
 * not tenants: they are operators, and operator access is governed by ADR-4 —
 * named human accounts, separate from any tenant's identity, with every action
 * attributable. "Who may publish an announcement" is therefore an ADR-4
 * question with an ADR-4 answer, and the tenant model is untouched.
 *
 * What is deliberately NOT built here: an authoring UI, image upload, asset
 * storage, scheduling, or an admin auth path. Each is real scope, and none of
 * it is visible on the page this module feeds. The static list below is the
 * stand-in, shaped field-for-field like the response it will become so that
 * swapping in a `fetch` is a one-file change.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * PLACEHOLDER CONTENT. The four entries are authored, not fetched. They are
 * written the way a platform team actually writes — a date, a consequence, and
 * what the reader has to do — and they contain no fabricated measurements,
 * because a made-up number on a page people trust is worse than no number.
 */

/**
 * Which inline illustration accompanies the entry.
 *
 * A key rather than an image URL: the artwork is drawn in SVG from design
 * tokens (see `AnnouncementArt`), so the repository stays text-only, the page
 * works offline, and an announcement cannot arrive carrying a 2 MB photograph
 * that nobody compressed.
 */
export type AnnouncementArtKey =
  | 'migration'
  | 'dataset'
  | 'incident'
  | 'deprecation';

export type AnnouncementTone = 'neutral' | 'attention';

export interface Announcement {
  id: string;
  /** ISO-8601 date the announcement was published. */
  date: string;
  /** Short label above the title — the kind of thing this is. */
  category: string;
  title: string;
  /** Two or three sentences. Longer than this and it wants to be a document. */
  body: string;
  art: AnnouncementArtKey | null;
  /** `attention` earns a warning badge. Reserve it for things with a deadline. */
  tone: AnnouncementTone;
  /** Optional call to action. External, so it opens in its own tab. */
  link?: {
    label: string;
    href: string;
  };
}

export const ANNOUNCEMENTS: readonly Announcement[] = [
  {
    id: 'warehouse-migration-november',
    date: '2026-10-02',
    category: 'Planned maintenance',
    title: 'Warehouse migration window: 14–15 November',
    body: 'The warehouse moves to the new cluster over the weekend of 14 November, starting 22:00 UTC on the Friday. Queries will fail rather than return stale rows for the duration, so scheduled jobs in that window should be paused or allowed to retry. No query or connection string changes are required afterwards.',
    art: 'migration',
    tone: 'attention',
    link: {
      label: 'Migration runbook and exact timings',
      href: 'https://github.com/example/insights-platform/blob/main/docs/runbooks/warehouse-migration.md',
    },
  },
  {
    id: 'vendor-spend-dataset',
    date: '2026-09-29',
    category: 'New data',
    title: 'Vendor spend is available to standard tier',
    body: 'Three years of vendor spend is now exposed through the warehouse with per-tenant row filters already applied, so a tenant sees its own rows and nothing else without writing a predicate for it. Access is granted per warehouse role rather than by default.',
    art: 'dataset',
    tone: 'neutral',
    link: {
      label: 'Request access for your tenant',
      href: 'https://github.com/example/insights-platform/blob/main/ONBOARDING.md',
    },
  },
  {
    id: 'incident-retro-september',
    date: '2026-09-19',
    category: 'Incident review',
    title: 'Retrospective: sign-in failures on 16 September',
    body: 'A configuration change rolled out to the identity service without the staged rollout it was supposed to use, and new sign-ins failed until it was reverted. Sessions already issued were unaffected. The staged rollout is now enforced by the pipeline rather than by the person running it, and the retrospective is open for anyone to read.',
    art: 'incident',
    tone: 'neutral',
    link: {
      label: 'Read the retrospective',
      href: 'https://github.com/example/insights-platform/blob/main/docs/incidents/2026-09-16-identity.md',
    },
  },
  {
    id: 'sdk-tenant-argument-removal',
    date: '2026-09-24',
    category: 'Deprecation',
    title: 'SDK 0.5 removes the tenant argument from data.query()',
    body: 'The tenant now comes from the verified token on every call, which closes the gap where a hand-written query could pass a tenant the caller was not entitled to. Passing it explicitly warns in 0.4 and stops working in 0.5, expected November 2026. Deleting the argument is the whole migration.',
    art: 'deprecation',
    tone: 'attention',
    link: {
      label: 'SDK 0.4 release notes',
      href: 'https://github.com/example/insights-platform/tree/main/packages/sdk-python',
    },
  },
];
