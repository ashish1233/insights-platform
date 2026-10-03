/**
 * The platform changelog the hub shows on its landing page.
 *
 * PLACEHOLDER CONTENT. These entries are authored, not fetched — in production
 * this is `GET /registry/releases`, projected from the SDK's and the kit's
 * release notes so that nobody has to remember to update a second list.
 *
 * Why this is on the landing page at all: a platform that three engineers
 * maintain lives or dies on whether twenty-five teams believe it is maintained.
 * A visible, dated feed is the cheapest evidence of that, and the `action`
 * field is the part that earns its space — a release note that does not say
 * what the reader must do is a release note nobody reads twice.
 */

export interface ReleaseEntry {
  /** ISO-8601 date. */
  date: string;
  /** Version of whichever component changed, or `null` for an announcement. */
  version: string | null;
  component: 'SDK' | 'UI kit' | 'Platform' | 'Data';
  title: string;
  summary: string;
  /** What the reader has to do, if anything. Shown only when present. */
  action?: string;
  /** Set for anything with a deadline attached. */
  deadline?: string;
}

export const RELEASES: readonly ReleaseEntry[] = [
  {
    date: '2026-10-01',
    version: '0.1.0',
    component: 'Platform',
    title: 'Insights Hub shell is live',
    summary:
      'Standard-tier apps now mount inside one origin with shared navigation and a single sign-in. Restricted-tier apps keep their own origin and appear here as a link.',
    action: 'Nothing. Your app also still runs at its own URL, and always will.',
  },
  {
    date: '2026-09-24',
    version: '0.4.0',
    component: 'SDK',
    title: 'Scoped data client no longer accepts a raw tenant id',
    summary:
      'The tenant now comes from the verified token on every call, closing the gap where a handwritten query could pass the wrong one.',
    action:
      'Drop the `tenant_id=` argument from `data.query(...)`. The old form warns in 0.4 and is removed in 0.5.',
    deadline: 'Removed in 0.5.0, expected November 2026.',
  },
  {
    date: '2026-09-17',
    version: null,
    component: 'Data',
    title: 'Vendor spend dataset available to standard tier',
    summary:
      'Three years of vendor spend is now exposed through the warehouse with per-tenant row filters already in place.',
    action: 'Ask the platform team to add `spend_vendor` to your warehouse role.',
  },
  {
    date: '2026-09-02',
    version: '0.1.0',
    component: 'UI kit',
    title: 'Local font stack replaces the bundled webfont',
    summary:
      'Pages render immediately instead of flashing unstyled text, and the kit ships 180 kB lighter.',
    action:
      'Remove any `@font-face` left over in your app. Nothing else changes.',
  },
];
