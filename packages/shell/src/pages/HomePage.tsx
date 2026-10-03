import { SplitColumns, Text } from '@insights-platform/ui-kit';
import { APPS, appsForTenant } from '../registry/apps';
import type { RegisteredApp } from '../registry/apps';
import { Announcements } from '../components/Announcements';
import { AppDirectory } from '../components/AppDirectory';
import { GetStarted } from '../components/GetStarted';
import { RecentApps, novelRecents } from '../components/RecentApps';
import { StatusBanner } from '../components/StatusBanner';
import { WhatsNew } from '../components/WhatsNew';

export interface HomePageProps {
  /** Tenant from the signed-in token. Drives what leads the page. */
  homeTenant: string;
  /**
   * The signed-in user. Not rendered here — the kit's `AppShell` header already
   * says who you are, and the landing page repeating it was the page telling
   * someone something they could read two inches higher.
   */
  subject: string;
  recent: RegisteredApp[];
  navigate: (path: string) => void;
  onOpened: (appId: string) => void;
}

/**
 * The hub's landing page.
 *
 * Three people land here wanting different things, and the page is ordered by
 * how often each need occurs rather than by how important each feels to the
 * platform team:
 *
 *   - A **consumer** wants the report they read every week. The directory is
 *     the page — a card grid they can scan, with search three keystrokes away.
 *   - An **owner** wants to know whether their app is healthy and whether last
 *     night's job ran. Status by exception is the first line; their own
 *     tenant's apps lead the directory at full detail.
 *   - A **new team** wants one obvious path. That is genuinely rare, so it sits
 *     in the side column — findable, not occupying space the daily users need.
 *
 * The one thing nobody came for is the announcements panel, and that is exactly
 * why it is above the directory rather than below it: a migration window is
 * only useful if it reaches someone whose weekend does not yet include it. It
 * is kept to a single item's height, so the tax a daily reader pays for it is
 * one row of furniture.
 *
 * Deliberately absent: a left rail listing the same apps the grid lists, a
 * hero, a welcome message, a React-singleton debug badge, and a tile of vanity
 * metrics. The rail and the badge both still exist on `/apps/:id`, where
 * switching apps is a real need and federation working is worth evidencing.
 *
 * Heading outline: the `h1` is the app name in the kit's `AppShell` header, so
 * everything here starts at `h2` and nothing skips a level.
 */
export function HomePage({
  homeTenant,
  recent,
  navigate,
  onOpened,
}: HomePageProps) {
  // Recents only earn their space when they would show something the grid
  // below does not. See `novelRecents`.
  const shortcuts = novelRecents(recent, appsForTenant(homeTenant), APPS.length);

  return (
    <div className="shell-home">
      <StatusBanner navigate={navigate} />

      <Announcements />

      <SplitColumns
        aside={
          <>
            <WhatsNew />
            <GetStarted />
            {/*
              The reason the ordering is what it is, in one line. It is here
              because "why is this app first" is otherwise unanswerable, and an
              unexplained ordering gets read as a ranking.
            */}
            <Text size="xs" tone="muted">
              Ordered by your tenant, {homeTenant} — not by anything you
              clicked.
            </Text>
          </>
        }
        asideLabel="Platform news and onboarding"
        asideWidth="340px"
      >
        <RecentApps apps={shortcuts} onOpened={onOpened} />
        <AppDirectory homeTenant={homeTenant} onOpened={onOpened} />
      </SplitColumns>
    </div>
  );
}
