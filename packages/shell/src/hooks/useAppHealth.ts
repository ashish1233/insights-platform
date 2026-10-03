import { useCallback, useEffect, useState } from 'react';
import type { HealthResponse } from '@insights-platform/ui-kit';
import type { AppTier } from '../registry/apps';

/**
 * `not-measured` is the state of a target the hub never polls, and it is a
 * first-class state rather than an absence.
 *
 * A restricted-tier app's backend does not list the hub's origin, and a
 * scheduled job has no browser-facing server at all. Both will refuse a
 * `fetch` from this page forever, by design. Representing that as
 * `unreachable` would put two permanent entries in a warning that is supposed
 * to mean "someone should look at this", and a warning that is always on is a
 * warning everybody learns to scroll past — including on the day it is about
 * something real. So the hub does not ask a question it knows it cannot have
 * answered, and says that it did not ask.
 */
export type HealthState =
  | 'loading'
  | 'ok'
  | 'unreachable'
  | 'tier-mismatch'
  | 'not-measured';

/**
 * Anything the shell health-checks: a registered app, or one of the three
 * shared services. A service has no tier, so the cross-check below is skipped
 * for it rather than being faked with a default.
 */
export interface HealthTarget {
  healthUrl: string;
  tier?: AppTier;
}

export interface AppHealth {
  state: HealthState;
  health: HealthResponse | null;
  error: string | null;
}

/**
 * Polls one registered app's `/health`.
 *
 * The ui-kit's `useHealth` is the right hook for an app reading *its own*
 * backend: it takes an API base and appends `/health`. The shell needs two
 * things it does not do — an arbitrary absolute URL per app, and a comparison
 * of the tier the backend reports against the tier the registry records.
 *
 * That comparison is the point. ADR-2 makes tier platform configuration, and
 * ADR-2 hangs the composition rule off it. If an app the registry calls
 * `standard` reports `restricted` from its own backend, the shell has been
 * mounting a restricted app into the shared realm. That is not a status dot,
 * it is an incident, and the shell says so rather than rendering a green tick.
 */
export function useAppHealth(app: HealthTarget, pollMs = 30_000): AppHealth {
  const [result, setResult] = useState<AppHealth>({
    state: 'loading',
    health: null,
    error: null,
  });

  const { healthUrl, tier } = app;

  const check = useCallback(
    async (signal: AbortSignal) => {
      try {
        const response = await fetch(healthUrl, { signal });
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const body = (await response.json()) as HealthResponse;
        setResult({
          state: tier && body.tier !== tier ? 'tier-mismatch' : 'ok',
          health: body,
          error: null,
        });
      } catch (cause) {
        if (signal.aborted) return;
        setResult({
          state: 'unreachable',
          health: null,
          error: cause instanceof Error ? cause.message : String(cause),
        });
      }
    },
    [healthUrl, tier],
  );

  useEffect(() => {
    const controller = new AbortController();
    void check(controller.signal);

    // A reporting shell does not need sub-second health. Polling keeps the
    // shell free of a socket to every tenant's backend, which is twenty-five
    // connections the platform team would otherwise own.
    const timer = window.setInterval(() => {
      void check(controller.signal);
    }, pollMs);

    return () => {
      controller.abort();
      window.clearInterval(timer);
    };
  }, [check, pollMs]);

  return result;
}
