import { AppShell, LoginPanel, useAuth, useHealth } from '@insights-platform/ui-kit';
import {
  APP_DESCRIPTION,
  APP_NAME,
  IDENTITY_BASE_URL,
  SCOPES,
  TENANT_ID,
  API_BASE_URL,
} from './config';
import { InsightsPage } from './InsightsPage';

/**
 * The app's two states: signed out, and signed in.
 *
 * Keep this file thin. Pages go in their own modules; this one only decides
 * which of the two states is on screen and owns the session.
 */
export function App() {
  const auth = useAuth({
    identityUrl: IDENTITY_BASE_URL,
    scopes: SCOPES,
  });

  // Unauthenticated, so the shell can label itself before anyone signs in.
  const { health } = useHealth({ apiUrl: API_BASE_URL });

  if (!auth.isAuthenticated) {
    return (
      <LoginPanel
        appName={APP_NAME}
        description={APP_DESCRIPTION}
        onSubmit={auth.login}
        busy={auth.status === 'signing-in'}
        defaultTenantId={TENANT_ID}
        errorTitle={auth.expired ? 'Session expired' : 'Could not sign in'}
        error={
          auth.expired
            ? 'Your session timed out. Sign in again to continue.'
            : auth.error
        }
      />
    );
  }

  return (
    <AppShell
      appName={APP_NAME}
      tenantId={health?.tenant_id}
      tier={health?.tier}
      subject={auth.session?.subject}
      onSignOut={() => auth.logout()}
    >
      <InsightsPage
        token={auth.token}
        // A rejected token ends the session and sends the user back to the
        // login screen with an explanation, rather than to a blank page.
        onSessionExpired={() => auth.logout({ expired: true })}
      />
    </AppShell>
  );
}
