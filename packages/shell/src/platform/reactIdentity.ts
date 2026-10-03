import * as React from 'react';

/**
 * Runtime proof that React is a singleton across the federation boundary.
 *
 * `shared: { react: { singleton: true } }` is a build-time *request*. Whether it
 * was honoured is only observable at runtime, and the failure mode is quiet:
 * the build succeeds, the bundle looks right, and the page is blank with
 * "Invalid hook call" in the console. So the shell asks every participant to
 * announce itself, and shows the answer on screen.
 *
 * The probe is React's internal dispatcher holder, not `React.version` — two
 * copies of the *same* version still break hooks, and the holder is the exact
 * object whose identity decides whether they do.
 *
 * In a real platform this file would ship from the ui-kit. It is duplicated
 * into the shell and each remote on purpose: a diagnostic that depends on the
 * shared package cannot diagnose a problem with the shared package.
 */

const KEY = '__insightsHubReactInstances__';

interface Participant {
  owner: string;
  probe: unknown;
  version: string;
}

function probe(): unknown {
  const internals = (React as unknown as Record<string, unknown>)
    .__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED;
  return internals ?? React;
}

function participants(): Participant[] {
  const scope = globalThis as unknown as Record<string, unknown>;
  if (!Array.isArray(scope[KEY])) scope[KEY] = [];
  return scope[KEY] as Participant[];
}

/** Called once, at module scope, by the shell and by each remote. */
export function reportReactInstance(owner: string): void {
  const all = participants();
  if (all.some((entry) => entry.owner === owner)) return;
  all.push({ owner, probe: probe(), version: React.version });
}

export interface ReactIdentityReport {
  /** Distinct React copies in this realm. Anything but 1 is a defect. */
  instances: number;
  /** Who announced themselves, in load order. */
  owners: string[];
  versions: string[];
}

export function reactIdentityReport(): ReactIdentityReport {
  const all = participants();
  const distinct: unknown[] = [];
  for (const entry of all) {
    if (!distinct.includes(entry.probe)) distinct.push(entry.probe);
  }
  return {
    instances: distinct.length,
    owners: all.map((entry) => entry.owner),
    versions: Array.from(new Set(all.map((entry) => entry.version))),
  };
}
