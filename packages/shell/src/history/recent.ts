import { useCallback, useEffect, useState } from 'react';
import { findApp } from '../registry/apps';
import type { RegisteredApp } from '../registry/apps';

/**
 * The last few apps this person opened.
 *
 * Cheap, local, and the single highest-value affordance in an internal portal:
 * most people use two or three of the twenty-five, every day, and a list that
 * remembers which spares them the directory entirely.
 *
 * `localStorage`, not the platform. This is a preference, not a fact about the
 * user — sending it to a server would turn "which reports do you open" into a
 * record someone else holds, for no benefit the user can feel. It also means a
 * corrupt or unavailable store degrades to an empty list rather than an error,
 * which is handled below.
 */

const STORAGE_KEY = 'insights.hub.recent';
const LIMIT = 4;

function read(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((id): id is string => typeof id === 'string');
  } catch {
    return [];
  }
}

function write(ids: string[]): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  } catch {
    // A full or disabled store costs the user a convenience, not a feature.
  }
}

export interface UseRecentAppsResult {
  /**
   * Resolved against the registry on every read, so an app that has been
   * removed or renamed disappears instead of rendering a dead card.
   */
  recent: RegisteredApp[];
  record: (appId: string) => void;
}

export function useRecentApps(): UseRecentAppsResult {
  const [ids, setIds] = useState<string[]>(read);

  // Opening an app in a new tab means the recording happens in *that* tab.
  // Without this the list in the tab the user came from stays stale until they
  // reload, which reads as the feature being broken.
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY) setIds(read());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const record = useCallback((appId: string) => {
    setIds((current) => {
      const next = [appId, ...current.filter((id) => id !== appId)].slice(
        0,
        LIMIT,
      );
      write(next);
      return next;
    });
  }, []);

  const recent = ids
    .map((id) => findApp(id))
    .filter((app): app is RegisteredApp => app !== undefined);

  return { recent, record };
}
