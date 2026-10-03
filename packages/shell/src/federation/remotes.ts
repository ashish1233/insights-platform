import { lazy } from 'react';
import type { ComponentType } from 'react';
import type { StandardApp, StandardAppId } from '../registry/apps';

/** What every mounted remote receives. Mirrors `remotes.d.ts`. */
export interface RemoteAppProps {
  token: string | null;
  tenantId: string;
  subject: string;
}

type RemoteComponent = ComponentType<RemoteAppProps>;
type RemoteLoader = () => Promise<{ default: RemoteComponent }>;

/**
 * Federated imports must be static strings — the plugin rewrites them at build
 * time, so `import(app.remoteUrl)` is not a thing that can work. That makes
 * this table the one place a remote becomes loadable.
 *
 * It is keyed by `StandardAppId`, a type derived from the registry. Two
 * consequences, both intended:
 *
 *   - A restricted app's id is not assignable to the key, so adding a loader
 *     for one is a compile error. This is the structural half of the ADR-2
 *     rule: the shell is not *able* to mount a restricted app, rather than
 *     merely choosing not to.
 *   - `Record` is total, so adding a standard-tier app to the registry without
 *     adding its loader here is also a compile error. A half-registered app
 *     fails the build instead of 404-ing at runtime.
 */
const REMOTE_LOADERS: Record<StandardAppId, RemoteLoader> = {
  'finance-spend-explorer': () => import('finance_spend_explorer/SpendExplorer'),
};

const cache = new Map<string, RemoteComponent>();

/**
 * Resolve the lazy component for a standard-tier app.
 *
 * It takes a `StandardApp`, not an id and not a `RegisteredApp` — a caller with
 * only a restricted entry in hand has nothing to pass. Narrowing happens once,
 * via `isFederated`, and the type carries the result from there.
 */
export function remoteComponentFor(app: StandardApp): RemoteComponent {
  const cached = cache.get(app.id);
  if (cached) return cached;

  // The cast is where the compile-time guarantee ends. It holds for the static
  // registry; once the registry arrives over HTTP, `app.id` is just a string
  // the platform sent us, and the check below is the enforcement.
  const load: RemoteLoader | undefined = REMOTE_LOADERS[app.id as StandardAppId];
  if (!load) {
    throw new Error(
      `No federation loader is registered for "${app.id}". A registry entry ` +
        'cannot make itself mountable; the shell has to ship a loader for it.',
    );
  }

  const component = lazy(load);
  cache.set(app.id, component);
  return component;
}
