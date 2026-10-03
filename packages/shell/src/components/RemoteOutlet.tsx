import { Component, Suspense } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { Alert, Button, Card, Text } from '@insights-platform/ui-kit';
import { remoteComponentFor } from '../federation/remotes';
import type { RemoteAppProps } from '../federation/remotes';
import type { StandardApp } from '../registry/apps';
import { reactIdentityReport } from '../platform/reactIdentity';

/**
 * Mounts a standard-tier remote.
 *
 * Takes a `StandardApp`. There is no overload, no `id: string` entry point and
 * no tier check inside — a caller holding a restricted entry has nothing it can
 * pass, which is the ADR-2 rule expressed as a signature rather than a guard.
 */

interface BoundaryProps {
  appName: string;
  /** Changing this remounts the boundary, so a fixed remote recovers. */
  resetKey: string;
  children: ReactNode;
}

interface BoundaryState {
  error: Error | null;
}

/**
 * One remote failing must not take the shell with it. ADR-2 notes the shell is
 * on the critical path of twenty-five apps; "a remote threw" has to degrade to
 * one broken panel, not a blank hub.
 */
class RemoteBoundary extends Component<BoundaryProps, BoundaryState> {
  override state: BoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): BoundaryState {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    // eslint-disable-next-line no-console
    console.error(`[shell] remote "${this.props.appName}" failed`, error, info);
  }

  override componentDidUpdate(previous: BoundaryProps): void {
    if (previous.resetKey !== this.props.resetKey && this.state.error) {
      this.setState({ error: null });
    }
  }

  override render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;

    const identity = reactIdentityReport();
    const duplicateReact = identity.instances > 1;
    const hookFailure = /invalid hook call|hooks can only be called/i.test(
      error.message,
    );

    return (
      <Card title={`${this.props.appName} could not be loaded`}>
        <Alert
          tone="danger"
          title={error.message}
          action={
            <Button
              size="sm"
              variant="secondary"
              onClick={() => window.location.reload()}
            >
              Reload
            </Button>
          }
        >
          {duplicateReact || hookFailure ? (
            <>
              <strong>
                {identity.instances} copies of React are loaded in this page
                ({identity.owners.join(', ')}).
              </strong>{' '}
              The remote was built without React marked{' '}
              <code>singleton: true</code>, or its `requiredVersion` did not
              match the shell&rsquo;s. Both builds succeed in that state; only
              the page breaks.
            </>
          ) : (
            <>
              The remote entry could not be fetched or evaluated. The app is
              still reachable on its own origin — the shell being down is not
              the app being down.
            </>
          )}
        </Alert>
      </Card>
    );
  }
}

export function RemoteOutlet({
  app,
  session,
}: {
  app: StandardApp;
  session: RemoteAppProps;
}) {
  const Remote = remoteComponentFor(app);

  return (
    <RemoteBoundary appName={app.name} resetKey={app.id}>
      <Suspense
        fallback={
          <Card title={app.name}>
            <Text size="sm" tone="muted">
              Loading {app.name} from {app.remoteUrl}…
            </Text>
          </Card>
        }
      >
        <Remote {...session} />
      </Suspense>
    </RemoteBoundary>
  );
}
