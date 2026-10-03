/**
 * Type declarations for the virtual modules `@originjs/vite-plugin-federation`
 * creates from the host's `remotes` map.
 *
 * A federated import has no module on disk to infer from, so without this the
 * remote is `any` and the host↔remote contract is unchecked at exactly the
 * boundary where a mistake is most expensive. Keeping it hand-written is the
 * honest version of that cost: the remote and the shell are separate
 * repositories with separate release cadences (ADR-1), so this file is a
 * published contract between them, not a derived artefact.
 *
 * There is deliberately no declaration for any restricted-tier app. Adding one
 * would not help — `vite.config.ts` only creates containers for standard-tier
 * registry entries, so the import would fail to resolve at build time.
 *
 * The filename is `remote-modules.d.ts`, not `remotes.d.ts`, because TypeScript
 * treats `X.d.ts` beside `X.ts` as that file's generated declarations and
 * ignores it. The ambient module would silently not exist.
 */

declare module 'finance_spend_explorer/SpendExplorer' {
  import type { ComponentType } from 'react';

  /** The whole host→remote contract. Keep it this small. */
  export interface RemoteAppProps {
    /** The shell's session token, or `null` when signed out. */
    token: string | null;
    tenantId: string;
    subject: string;
  }

  const SpendExplorer: ComponentType<RemoteAppProps>;
  export default SpendExplorer;
}
