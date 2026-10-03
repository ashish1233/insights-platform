import { useCallback, useEffect, useState } from 'react';

/**
 * Hash routing, deliberately.
 *
 * `#/app/<id>` needs no server rewrite rule, which matters because the shell is
 * served as static files from the same place as every other app here. A router
 * library would add a shared dependency that federation then has to keep as a
 * singleton across twenty-five remotes — exactly the version coupling ADR-2
 * flagged as the cost of this design. Not worth it for one level of routing.
 */
export interface Route {
  /** The app id in `#/app/<id>`, or `null` for the home listing. */
  appId: string | null;
}

function parse(hash: string): Route {
  const match = /^#\/app\/([^/?#]+)/.exec(hash);
  return { appId: match?.[1] ? decodeURIComponent(match[1]) : null };
}

export function useHashRoute(): Route & { navigate: (appId: string | null) => void } {
  const [route, setRoute] = useState<Route>(() =>
    parse(typeof window === 'undefined' ? '' : window.location.hash),
  );

  useEffect(() => {
    const onHashChange = () => setRoute(parse(window.location.hash));
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const navigate = useCallback((appId: string | null) => {
    window.location.hash = appId ? `#/app/${encodeURIComponent(appId)}` : '#/';
  }, []);

  return { ...route, navigate };
}
