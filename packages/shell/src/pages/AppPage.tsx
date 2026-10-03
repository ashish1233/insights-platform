import { Text } from '@insights-platform/ui-kit';
import { isFederated, isLinkedOut } from '../registry/apps';
import type { RegisteredApp } from '../registry/apps';
import { AppCard } from '../components/AppCard';
import { RemoteOutlet } from '../components/RemoteOutlet';
import { RestrictedLinkCard } from '../components/RestrictedLinkCard';
import type { RemoteAppProps } from '../federation/remotes';

export interface AppPageProps {
  app: RegisteredApp;
  session: RemoteAppProps;
  navigate: (path: string) => void;
  onOpened: (appId: string) => void;
}

/**
 * The composition decision, in one place and in one expression.
 *
 * `isFederated` is the only branch in the shell that decides whether something
 * is mounted. It narrows `RegisteredApp` to `StandardApp`, and `RemoteOutlet`
 * accepts nothing wider — so the "otherwise" arm has no mounting path
 * available to it even if a future edit tried to take one. The rule is not
 * "remember to check the tier"; the rule is that the restricted branch has no
 * remote to reach for.
 *
 * This page is also what a standard-tier card opens in its new tab, which is
 * why it has to stay a first-class route rather than becoming an interstitial.
 */
export function AppPage({ app, session, navigate, onOpened }: AppPageProps) {
  if (isFederated(app)) {
    return (
      <>
        <RemoteOutlet app={app} session={session} />
        <Text size="sm" tone="muted" style={{ marginTop: 'var(--ins-space-lg)' }}>
          Federated from <code>{app.remoteUrl}</code>. The same app also runs
          standalone at <code>{app.standaloneUrl}</code>, which is where to go
          if the hub is down.
        </Text>
      </>
    );
  }

  if (isLinkedOut(app)) {
    return <RestrictedLinkCard app={app} onOpened={onOpened} />;
  }

  /*
   * A job. There is no fourth composition mode to add here — a job has no UI,
   * so its directory entry is already the whole of it. Reusing `AppCard`
   * rather than writing a second layout keeps the two renderings from drifting.
   */
  return (
    <>
      <AppCard app={app} navigate={navigate} headingLevel="h2" />
      <Text size="sm" tone="muted" style={{ marginTop: 'var(--ins-space-lg)' }}>
        Scheduled jobs run on a service identity from the <code>{app.repo}</code>{' '}
        repository and never render anything. They are listed in the hub because
        a directory that shows only web apps misrepresents what the platform
        actually runs.
      </Text>
    </>
  );
}
