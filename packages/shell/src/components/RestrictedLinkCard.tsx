import { Badge, Card, MetaRow, Text } from '@insights-platform/ui-kit';
import type { RestrictedApp } from '../registry/apps';
import { useRegisteredAppHealth } from '../health/HealthProvider';

/**
 * How a restricted-tier app appears in the shell: a link out, never a mount.
 *
 * This component's type is `RestrictedApp`. A standard-tier entry cannot be
 * passed to it and a restricted entry cannot be passed to `RemoteOutlet` — the
 * two render paths are disjoint at the type level rather than separated by an
 * `if` someone can later invert.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * WHY THE SCREEN SAYS SO LITTLE
 *
 * The reasoning below used to be on the card, in full, as three paragraphs of
 * prose. It is good reasoning and it was poor interface copy — nobody reads an
 * essay on a card, and the page it was on is one somebody opens every morning.
 * It lives here now, where the next engineer will actually find it.
 *
 * **Why this app is not federated.** Module Federation would put it in the same
 * browser origin and the same JavaScript realm as every other app on the hub,
 * where nothing but the good behaviour of the other tenants stands between its
 * rendered figures and their code. A separate origin is the only preventive
 * boundary a browser actually enforces, so compensation data keeps one
 * (ADR-2).
 *
 * **Why the second sign-in is not a bug.** A separate origin means a separate
 * session. That cost is the boundary working, and the user is told it is
 * coming rather than discovering it.
 *
 * **Why there is no health tick.** This app's backend does not list the hub
 * among its allowed origins, and CORS is configured per application rather than
 * per route — so opening it up for `/health` would also hand the hub's realm
 * the restricted `/api/insights`, which is the exact thing ADR-2 refuses. The
 * hub therefore does not poll it at all, rather than provoking a refusal and
 * reporting it as a fault. The fix is a platform-side poller, not a wider
 * allowlist; see `healthIsBrowserReadable`.
 *
 * What stays on screen is the one sentence a user needs for each: where it
 * opens, and who measured its status.
 */
export function RestrictedLinkCard({
  app,
  onOpened,
}: {
  app: RestrictedApp;
  onOpened?: (appId: string) => void;
}) {
  const { state, health } = useRegisteredAppHealth(app.id);

  return (
    <Card
      title={app.name}
      description={app.description}
      actions={<Badge tone="restricted">Restricted tier</Badge>}
    >
      <MetaRow
        items={[
          <span className="shell-mono">{app.tenant}</span>,
          state === 'ok' && health
            ? `Healthy · SDK ${health.sdk_version}`
            : state === 'loading'
              ? 'Checking…'
              : state === 'tier-mismatch'
                ? `Reports tier “${health?.tier}” — expected restricted`
                : 'Status reported by the platform, not the hub',
        ]}
      />

      <Text size="sm" tone="muted" style={{ marginTop: 'var(--ins-space-md)' }}>
        Opens in its own origin. You will sign in again there.
      </Text>

      <div style={{ marginTop: 'var(--ins-space-xl)' }}>
        {/*
          A real anchor, not a Button with an onClick. ⌘-click and middle-click
          have to work on the one control whose entire purpose is "this opens
          somewhere else".

          `noopener` matters more than usual here. Without it the opened window
          gets a handle back to this one through `window.opener` — a thread
          between the two origins, and the entire point of this card is that
          there is no thread.
        */}
        <a
          className="shell-open"
          href={app.href}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => onOpened?.(app.id)}
        >
          Open {app.name}
          <span aria-hidden="true"> ↗</span>
        </a>
      </div>

      <Text
        size="xs"
        tone="muted"
        mono
        style={{ marginTop: 'var(--ins-space-md)' }}
      >
        {app.href}
      </Text>
    </Card>
  );
}
