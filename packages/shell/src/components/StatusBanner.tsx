import { Alert, MetaRow, Text } from '@insights-platform/ui-kit';
import { APPS, healthIsBrowserReadable, tenants } from '../registry/apps';
import { SHARED_SERVICES } from '../registry/services';
import { PLATFORM_SDK_VERSION } from '../config';
import { useAllHealth } from '../health/HealthProvider';
import { Link } from '../routing/Link';

/**
 * Status by exception, and the exception has to be real.
 *
 * The version this replaced reported "3 things are not responding", and one of
 * the three was the restricted-tier app's health being unreadable from the hub
 * — which is not a fault, it is ADR-2 working exactly as designed. A warning
 * that includes a designed-in condition is a warning that is on every single
 * day, and a warning that is on every day teaches twenty-five teams to scroll
 * past it. The cost of that is not paid on the quiet days; it is paid on the
 * one morning the amber means something.
 *
 * So the strip now distinguishes two things that look identical to a `fetch`
 * and are not remotely the same fact:
 *
 *   - **Genuine problems** — something the hub *can* read said something is
 *     wrong, or stopped answering. These earn an Alert that names the app.
 *   - **Not measured from here** — a restricted app's backend, a job with no
 *     browser-facing server, the warehouse and the audit sink. The hub does not
 *     poll these at all (see `healthIsBrowserReadable`), and each says so on
 *     its own card as a neutral note about who is doing the measuring.
 *
 * When everything genuinely readable is fine, this is one calm line. Not a
 * green banner: a banner announcing that nothing has happened is furniture the
 * daily reader scrolls past forever, and it would be sitting in the best space
 * on the page.
 */
export function StatusBanner({ navigate }: { navigate: (path: string) => void }) {
  const health = useAllHealth();

  // Only apps whose health the hub can actually read are candidates for being
  // reported as a problem. Everything else is not a silent pass — it is a
  // question the hub never asked.
  const measurable = APPS.filter(healthIsBrowserReadable);

  const degraded = measurable.filter((app) => {
    const state = health[app.id]?.state;
    return state === 'unreachable' || state === 'tier-mismatch';
  });

  const mismatched = degraded.filter(
    (app) => health[app.id]?.state === 'tier-mismatch',
  );

  const degradedServices = SHARED_SERVICES.filter(
    (service) =>
      service.browserReadable && health[service.id]?.state === 'unreachable',
  );

  const checking = measurable.some(
    (app) => (health[app.id]?.state ?? 'loading') === 'loading',
  );

  const problems = degraded.length + degradedServices.length;

  const scale = (
    <MetaRow
      items={[
        `${tenants().length} tenants`,
        `${APPS.filter((app) => app.kind === 'web').length} apps`,
        `${APPS.filter((app) => app.kind === 'job').length} scheduled job`,
        `SDK ${PLATFORM_SDK_VERSION}`,
      ]}
    />
  );

  if (problems === 0) {
    return (
      <div className="shell-status">
        <div className="shell-status-state">
          {checking ? (
            <Text as="span" size="sm" tone="muted">
              Checking health…
            </Text>
          ) : (
            <>
              <span className="shell-status-dot" aria-hidden="true" />
              <Text as="span" size="sm" weight="medium">
                All reachable services healthy
              </Text>
            </>
          )}
        </div>
        {scale}
      </div>
    );
  }

  return (
    <Alert
      /*
       * A tier mismatch is a different class of problem from an app going
       * quiet: it means an app the registry calls standard is reporting itself
       * restricted, so the shell may already have mounted restricted code into
       * the shared realm. That is an incident, and it outranks availability.
       */
      tone={mismatched.length > 0 ? 'danger' : 'warning'}
      title={
        mismatched.length > 0
          ? 'Tier mismatch — an app disagrees with the registry'
          : `${problems} ${problems === 1 ? 'service is' : 'services are'} not responding`
      }
      className="shell-status-alert"
    >
      <ul className="shell-status-list">
        {degraded.map((app) => (
          <li key={app.id}>
            <Link href={app.route} navigate={navigate} className="shell-link-inline">
              {app.name}
            </Link>{' '}
            <Text as="span" size="sm" tone="muted">
              ({app.tenant}) —{' '}
              {health[app.id]?.state === 'tier-mismatch'
                ? `reports tier "${health[app.id]?.health?.tier}", registry says "${app.tier}"`
                : (health[app.id]?.error ?? 'no response')}
            </Text>
          </li>
        ))}
        {degradedServices.map((service) => (
          <li key={service.id}>
            <Text as="span" size="sm" weight="medium">
              {service.name}
            </Text>{' '}
            <Text as="span" size="sm" tone="muted">
              — {service.impact}
            </Text>
          </li>
        ))}
      </ul>
    </Alert>
  );
}
