import { useCallback, useEffect, useState } from 'react';
import { APPS } from '../registry/apps';
import type { RegisteredApp } from '../registry/apps';

/**
 * Path routing, not hash routing.
 *
 * The earlier hash router was simpler to serve, and it had to go: every app in
 * the directory is now a real `<a href>` so that middle-click and ⌘-click work,
 * and a URL a user can read, copy and paste into a ticket is worth more than
 * avoiding one line of static-host configuration. The route a card points at is
 * the same `route:` recorded in `insights-platform/tenants/*.yaml`, so the shell
 * and the manifests cannot drift about where an app lives.
 *
 * Requires SPA fallback — any unmatched path serves `index.html`. Vite's dev
 * and preview servers do this by default; a real deployment needs the
 * equivalent rewrite rule.
 */

export type Route =
  | { kind: 'home' }
  | { kind: 'app'; app: RegisteredApp }
  | { kind: 'not-found'; path: string };

export const HOME_PATH = '/';

function matchPath(pathname: string): Route {
  const path = pathname.replace(/\/+$/, '') || '/';
  if (path === '/') return { kind: 'home' };

  const app = APPS.find((candidate) => candidate.route === path);
  return app ? { kind: 'app', app } : { kind: 'not-found', path };
}

/**
 * Legacy `#/app/<id>` links, from before this router existed, are rewritten in
 * place rather than 404-ing. Someone has a bookmark; a redirect is two lines.
 */
function upgradeLegacyHash(): void {
  const match = /^#\/app\/([^/?#]+)/.exec(window.location.hash);
  if (!match?.[1]) return;

  const app = APPS.find((candidate) => candidate.id === match[1]);
  window.history.replaceState(null, '', app ? app.route : HOME_PATH);
}

export interface UseRouteResult {
  route: Route;
  /** Client-side navigation. Real links call this only on a plain left-click. */
  navigate: (path: string) => void;
}

export function useRoute(): UseRouteResult {
  const [pathname, setPathname] = useState(() => {
    if (typeof window === 'undefined') return HOME_PATH;
    upgradeLegacyHash();
    return window.location.pathname;
  });

  useEffect(() => {
    const onPopState = () => setPathname(window.location.pathname);
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const navigate = useCallback((path: string) => {
    if (path === window.location.pathname) return;
    window.history.pushState(null, '', path);
    setPathname(path);
    // A new page starts at the top. Browsers do this for a real navigation and
    // not for pushState, and the difference is disorienting when you have just
    // clicked something near the bottom of a long directory.
    window.scrollTo({ top: 0 });
  }, []);

  return { route: matchPath(pathname), navigate };
}
