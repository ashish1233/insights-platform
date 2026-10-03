import { useEffect } from 'react';
import { AppShell, LoginPanel, useAuth } from '@insights-platform/ui-kit';
import { APP_DESCRIPTION, APP_NAME, IDENTITY_BASE_URL, SCOPES } from './config';
import { FederationDiagnostics } from './components/FederationDiagnostics';
import { HealthProvider } from './health/HealthProvider';
import { useRecentApps } from './history/recent';
import { AppPage } from './pages/AppPage';
import { HomePage } from './pages/HomePage';
import { NotFoundPage } from './pages/NotFoundPage';
import { Link } from './routing/Link';
import { HOME_PATH, useRoute } from './routing/useRoute';

/**
 * The host.
 *
 * It owns exactly three things — the session, the nav, and the route — and
 * hands everything else to a registered app. Anything more and the shell
 * becomes the monolithic frontend that ADR-1's repository boundary exists to
 * avoid, with twenty-five teams queuing behind its release.
 */
export function App() {
  const auth = useAuth({ identityUrl: IDENTITY_BASE_URL, scopes: SCOPES });
  const { route, navigate } = useRoute();
  const { recent, record } = useRecentApps();

  const currentAppId = route.kind === 'app' ? route.app.id : null;

  /*
   * Recording happens on arrival, not on click, so that a tab opened with
   * ⌘-click — or a URL pasted from a colleague — counts the same as one opened
   * from a card. Recording only on click would miss exactly the cases the
   * new-tab behaviour was introduced to support.
   */
  useEffect(() => {
    if (currentAppId) record(currentAppId);
  }, [currentAppId, record]);

  if (!auth.isAuthenticated) {
    return (
      <LoginPanel
        appName={APP_NAME}
        description={APP_DESCRIPTION}
        onSubmit={auth.login}
        busy={auth.status === 'signing-in'}
        errorTitle={auth.expired ? 'Session expired' : 'Could not sign in'}
        error={
          auth.expired
            ? 'Your session timed out. Sign in again to continue.'
            : auth.error
        }
      />
    );
  }

  const homeTenant = auth.session?.tenantId ?? '';
  const subject = auth.session?.subject ?? '';
  const session = { token: auth.token, tenantId: homeTenant, subject };

  /*
   * There is no navigation rail, on either page.
   *
   * On the hub it listed exactly the apps the directory below it listed — two
   * controls doing one job. On an app page the argument for keeping it was
   * "switching apps is the common move", and that turned out to be the wrong
   * trade: it spends 260px of every tenant's canvas on a control the header's
   * "← All applications" link already provides.
   *
   * The shell's job is chrome, session and routing. An app page should be the
   * app, full width. A platform that permanently annexes a quarter of the
   * viewport from the thing a team actually built is advertising itself at its
   * tenants' expense.
   *
   * `FederationDiagnostics` stays on app pages only. "How many copies of React
   * are in this page" is developer output and there is no remote mounted on the
   * hub for it to be about — but on an app page it is the only thing that tells
   * you the singleton request in both builds was actually honoured, which a
   * green build does not.
   */
  const isHome = route.kind === 'home';

  return (
    <HealthProvider>
      <AppShell
        appName={APP_NAME}
        // The hub is the only page on the platform with a directory and a side
        // column. Everything a tenant builds keeps the kit's narrower default.
        maxWidth="1440px"
        tenantId={homeTenant}
        /*
         * The shell is not a tenant and has no tier of its own. Passing one
         * would put a badge in the header that describes nothing — tier
         * belongs to the app on screen, and the nav and the cards show it
         * there.
         */
        subject={subject}
        onSignOut={() => auth.logout()}
        headerActions={
          route.kind !== 'home' ? (
            <Link href={HOME_PATH} navigate={navigate} className="shell-link-inline">
              ← All applications
            </Link>
          ) : null
        }
      >
        <div className="shell-layout-plain">
          <div className="shell-content">
            {route.kind === 'home' ? (
              <HomePage
                homeTenant={homeTenant}
                subject={subject}
                scopes={auth.session?.scopes ?? []}
                recent={recent}
                navigate={navigate}
                onOpened={record}
              />
            ) : route.kind === 'app' ? (
              <AppPage
                app={route.app}
                session={session}
                navigate={navigate}
                onOpened={record}
              />
            ) : (
              <NotFoundPage path={route.path} navigate={navigate} />
            )}

            {isHome ? null : (
              <FederationDiagnostics watch={currentAppId ?? 'home'} />
            )}
          </div>
        </div>
      </AppShell>
    </HealthProvider>
  );
}
