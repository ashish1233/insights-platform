import { Badge } from '@insights-platform/ui-kit';
import type { BadgeTone } from '@insights-platform/ui-kit';
import { useRegisteredAppHealth } from '../health/HealthProvider';
import type { HealthState } from '../hooks/useAppHealth';

const LABEL: Record<HealthState, string> = {
  loading: 'Checking…',
  ok: 'Healthy',
  // "No response", not "Down". A browser cannot tell a stopped backend from
  // one that simply does not trust this origin, and for a restricted-tier app
  // the second is the normal, designed case. Labelling it "Down" would teach
  // everyone to ignore the one app where health matters most.
  unreachable: 'No response',
  'tier-mismatch': 'Tier mismatch',
  // The hub never asked. A restricted app's backend does not answer this
  // origin and a job has no browser-facing server, so there is nothing to
  // report and saying "No response" would invent a fault. See
  // `healthIsBrowserReadable`.
  'not-measured': 'Platform-reported',
};

const TONE: Record<HealthState, BadgeTone> = {
  loading: 'neutral',
  ok: 'success',
  unreachable: 'warning',
  // Not `warning`. A tier disagreement between the registry and the app's own
  // backend means the composition rule may have been applied to the wrong
  // premise, and it should look as bad as it is.
  'tier-mismatch': 'danger',
  'not-measured': 'neutral',
};

export function HealthBadge({ appId }: { appId: string }) {
  const { state } = useRegisteredAppHealth(appId);
  return <Badge tone={TONE[state]}>{LABEL[state]}</Badge>;
}

/**
 * The nav's status mark, and it marks only exceptions.
 *
 * A dot beside all twenty-five entries is wallpaper: a reader learns in a week
 * that they are always green and stops seeing them, which is the week one turns
 * amber. Healthy renders nothing at all, so the one thing that is wrong is the
 * only thing with a mark next to it.
 */
export function HealthDot({ appId }: { appId: string }) {
  const { state } = useRegisteredAppHealth(appId);
  if (state === 'ok' || state === 'loading' || state === 'not-measured') {
    return null;
  }

  return (
    <span
      className={
        state === 'tier-mismatch'
          ? 'shell-dot shell-dot-danger'
          : 'shell-dot shell-dot-warning'
      }
      role="img"
      aria-label={LABEL[state]}
      title={LABEL[state]}
    />
  );
}
