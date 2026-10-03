import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { APPS, healthIsBrowserReadable } from '../registry/apps';
import { SHARED_SERVICES } from '../registry/services';
import { useAppHealth } from '../hooks/useAppHealth';
import type { AppHealth, HealthTarget } from '../hooks/useAppHealth';

/**
 * One poller per health endpoint for the whole shell.
 *
 * The nav, the directory card and the app page all want the same app's health,
 * and a hook called in three places is three requests to every tenant's backend
 * on every interval. At twenty-five apps that is the shell quietly becoming the
 * heaviest client each tenant has.
 *
 * Apps and shared services share this registry under distinct ids, because the
 * question "is this endpoint answering" is the same question either way; what
 * differs is how the answer should be read, and that belongs in the components.
 */

const LOADING: AppHealth = { state: 'loading', health: null, error: null };
const NOT_MEASURED: AppHealth = {
  state: 'not-measured',
  health: null,
  error: null,
};

const HealthContext = createContext<Record<string, AppHealth>>({});

/**
 * The seed state for everything the hub deliberately does not poll.
 *
 * Built once, outside the component, so that a restricted app and a job are
 * `not-measured` from the very first render rather than spending a tick in
 * `loading` — a status that settles from "checking…" into "not measured" reads
 * as something having failed, which is the opposite of what happened.
 */
const UNPOLLED: Record<string, AppHealth> = Object.fromEntries([
  ...APPS.filter((app) => !healthIsBrowserReadable(app)).map((app) => [
    app.id,
    NOT_MEASURED,
  ]),
  ...SHARED_SERVICES.filter((service) => !service.browserReadable).map(
    (service) => [service.id, NOT_MEASURED],
  ),
]);

function HealthProbe({
  id,
  target,
  onChange,
}: {
  id: string;
  target: HealthTarget;
  onChange: (id: string, health: AppHealth) => void;
}) {
  const health = useAppHealth(target);
  useEffect(() => {
    onChange(id, health);
  }, [id, health, onChange]);
  return null;
}

export function HealthProvider({ children }: { children: ReactNode }) {
  const [byId, setById] = useState<Record<string, AppHealth>>(UNPOLLED);

  const onChange = useCallback((id: string, health: AppHealth) => {
    setById((current) =>
      current[id] === health ? current : { ...current, [id]: health },
    );
  }, []);

  const probes = useMemo(
    () => [
      /*
       * Only targets a browser on this origin can actually reach are polled —
       * and that is the whole of the fix for a status strip that cried wolf.
       *
       * A restricted app's backend will refuse this origin forever and a job
       * has no browser-facing server at all, so polling them produces a
       * guaranteed failure, every thirty seconds, for the life of the
       * platform. Reporting a refusal the hub provoked by asking a question it
       * knew the answer to is not monitoring; it is manufacturing an alarm. It
       * is also twenty-five pointless requests a minute at full registry size.
       *
       * See `healthIsBrowserReadable` and `SharedService.browserReadable`.
       */
      ...APPS.filter(healthIsBrowserReadable).map((app) => (
        <HealthProbe key={app.id} id={app.id} target={app} onChange={onChange} />
      )),
      ...SHARED_SERVICES.filter((service) => service.browserReadable).map(
        (service) => (
          <HealthProbe
            key={service.id}
            id={service.id}
            target={service}
            onChange={onChange}
          />
        ),
      ),
    ],
    [onChange],
  );

  return (
    <HealthContext.Provider value={byId}>
      {probes}
      {children}
    </HealthContext.Provider>
  );
}

/** Health for one registered app or shared service, by id. */
export function useRegisteredAppHealth(id: string): AppHealth {
  return useContext(HealthContext)[id] ?? LOADING;
}

export function useAllHealth(): Record<string, AppHealth> {
  return useContext(HealthContext);
}
