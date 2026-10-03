import federation from '@originjs/vite-plugin-federation';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { federationRemotes } from './src/registry/apps';

/**
 * The host.
 *
 * The `remotes` map is derived from the app registry, not written out here.
 * `federationRemotes()` filters on tier, so a restricted-tier entry produces no
 * remote container in this bundle at all — the ADR-2 rule survives into the
 * build artefact rather than living only in the source as a check someone could
 * delete. There is no string in the shipped shell that a restricted app could
 * be loaded from.
 */
export default defineConfig({
  plugins: [
    react(),
    federation({
      name: 'insights_hub_shell',
      remotes: federationRemotes(),
      /*
       * Declaring `shared` on the HOST is what makes React a singleton with
       * this plugin, and it is worth being precise about why.
       *
       * `@originjs/vite-plugin-federation` does not implement webpack's
       * `singleton` flag — it is commented out in the plugin's own types and
       * absent from its runtime. What it implements instead: the host writes
       * its copies into `globalThis.__federation_shared__[scope]` when it
       * initialises a remote container, and every remote's `importShared`
       * tries that share scope *first*, falling back to its own bundled copy
       * only if nothing there satisfies `requiredVersion`.
       *
       * So the single instance is a consequence of the host declaring these
       * and the remote's range matching — not of a flag asking for it. A
       * version bump on either side silently reintroduces two Reacts, with
       * both builds still green. That is precisely why the shell measures the
       * instance count at runtime (`platform/reactIdentity.ts`) rather than
       * trusting this block.
       */
      shared: {
        react: { requiredVersion: '^18.3.1' },
        'react-dom': { requiredVersion: '^18.3.1' },
      },
    }),
  ],
  server: {
    port: 5100,
  },
  preview: {
    port: 5100,
  },
  resolve: {
    /*
     * The ui-kit is installed from a local path, so resolving through its
     * symlink can reach the copy of React in *its* node_modules as well as the
     * app's. Two Reacts means hooks throw at runtime — and the build still
     * succeeds, so nothing catches it until the page is blank. Keep this.
     *
     * Federation's `shared` block solves the same problem across the remote
     * boundary; this one solves it inside the host's own dependency graph.
     * Both are needed and neither substitutes for the other.
     */
    dedupe: ['react', 'react-dom'],
  },
  optimizeDeps: {
    exclude: ['@insights-platform/ui-kit'],
  },
  build: {
    target: 'esnext',
    minify: false,
  },
});
