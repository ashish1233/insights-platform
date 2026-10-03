import { AUDIT_BASE_URL, IDENTITY_BASE_URL, WAREHOUSE_BASE_URL } from '../config';

/**
 * The three shared services every tenant depends on.
 *
 * They are listed separately from `apps.ts` because they are a different kind
 * of thing: nobody opens them, they have no tenant, and when one of them is
 * unhealthy the right reading is not "an app is down" but "the platform is
 * degraded and every app is about to look broken". Collapsing them into the app
 * directory would lose exactly that distinction.
 *
 * Locally these are the stubs from `insights-platform/docker-compose.yml`.
 */
export interface SharedService {
  id: string;
  name: string;
  /** What breaks first when it is unavailable. */
  impact: string;
  healthUrl: string;
  /**
   * Whether an outage stops work or merely degrades it. Audit is the
   * interesting one: fail-open for standard tier, fail-closed for restricted
   * (ADR-2), so the same outage means different things to different tenants.
   */
  severity: 'blocking' | 'degrading';
  /**
   * Whether a browser can read this service's `/health` at all.
   *
   * Only identity is called from a browser in normal operation — the sign-in
   * form posts to it — so only identity has a CORS policy. The warehouse and
   * the audit sink are reached by tenant *backends* and have no browser-facing
   * origin, which is correct and should stay that way: a warehouse that
   * answers a browser is a warehouse one XSS away from answering an attacker.
   *
   * So the shell does not poll them. It shows the platform-reported status
   * instead, clearly labelled, rather than polling an endpoint that cannot
   * answer and painting two thirds of the strip amber for a problem that does
   * not exist. The real fix is the same one the restricted-app health check
   * needs: the platform polls server-side and serves the result next to the
   * registry. `healthUrl` is kept on these entries so that switching to a
   * platform-side poller is a change of caller, not of shape.
   */
  browserReadable: boolean;
  /**
   * PLACEHOLDER. Stands in for what a platform-side poller would report for a
   * service the browser cannot reach. Fixed, not fetched — see above.
   */
  platformReportedStatus?: 'ok' | 'degraded';
}

export const SHARED_SERVICES: readonly SharedService[] = [
  {
    id: 'identity',
    name: 'Identity',
    impact: 'Nobody can sign in. Existing sessions keep working until they expire.',
    healthUrl: `${IDENTITY_BASE_URL}/health`,
    severity: 'blocking',
    browserReadable: true,
  },
  {
    id: 'warehouse',
    name: 'Warehouse',
    impact: 'Queries fail. Apps render their error state rather than stale data.',
    healthUrl: `${WAREHOUSE_BASE_URL}/health`,
    severity: 'blocking',
    browserReadable: false,
    platformReportedStatus: 'ok',
  },
  {
    id: 'audit',
    name: 'Audit sink',
    impact:
      'Standard-tier apps buffer events and carry on. Restricted-tier apps return 503 — fail-closed is the point (ADR-2).',
    healthUrl: `${AUDIT_BASE_URL}/health`,
    severity: 'degrading',
    browserReadable: false,
    platformReportedStatus: 'ok',
  },
];
