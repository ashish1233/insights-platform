import { Badge, Text } from '@insights-platform/ui-kit';
import { isFederated, isJob } from '../registry/apps';
import type { RegisteredApp } from '../registry/apps';

/**
 * The last few apps this person opened — when that is not simply the directory
 * again.
 *
 * The caller decides whether it has anything to add; see `novelRecents`. With
 * three apps registered, every recent entry is already on screen a few hundred
 * pixels below, and a row that restates the grid under a different heading is
 * worse than no row: it costs the vertical space the directory wanted and
 * teaches the reader that headings on this page do not mean anything.
 *
 * These are chips rather than cards. A recent is a one-word reminder of
 * something the reader already knows — the cards below carry the description,
 * the tenant and the health, and repeating all of it at the top of the page is
 * how a shortcut ends up slower than the thing it shortcuts.
 */
export function RecentApps({
  apps,
  onOpened,
}: {
  apps: RegisteredApp[];
  onOpened: (appId: string) => void;
}) {
  if (apps.length === 0) return null;

  return (
    <section className="shell-recent" aria-labelledby="recent-heading">
      <Text
        as="h2"
        size="xs"
        weight="semibold"
        id="recent-heading"
        className="shell-eyebrow"
      >
        Recently viewed
      </Text>

      <ul className="shell-chips">
        {apps.map((app) => {
          const job = isJob(app);
          const href = job
            ? app.route
            : isFederated(app)
              ? app.route
              : app.href;

          return (
            <li key={app.id}>
              <a
                className="shell-chip"
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => onOpened(app.id)}
              >
                <Text as="span" size="sm" weight="medium">
                  {app.name}
                </Text>
                {app.tier === 'restricted' ? (
                  <Badge tone="restricted">Restricted</Badge>
                ) : null}
                <span aria-hidden="true" className="shell-chip-arrow">
                  ↗
                </span>
              </a>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/**
 * The recents worth showing, given what the directory below already renders.
 *
 * Two conditions, and both have to hold. The entry must not already be visible
 * in the reader's own tenant group — the first thing under the heading — and
 * the directory as a whole must be long enough that scanning it costs
 * something. Below that threshold the grid *is* the shortcut.
 *
 * The threshold is the point at which a directory stops fitting on a screen
 * without scrolling, which is where "I know it is there somewhere" starts
 * costing more than a chip.
 */
const DIRECTORY_SCANNABLE_UP_TO = 6;

export function novelRecents(
  recent: RegisteredApp[],
  shownInFull: readonly RegisteredApp[],
  totalApps: number,
): RegisteredApp[] {
  if (totalApps <= DIRECTORY_SCANNABLE_UP_TO) return [];

  const visible = new Set(shownInFull.map((app) => app.id));
  return recent.filter((app) => !visible.has(app.id));
}
