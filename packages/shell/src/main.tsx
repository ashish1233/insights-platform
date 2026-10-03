import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

/*
 * The ui-kit stylesheet is loaded once, here, by the host.
 *
 * Federated remotes do not ship their own copy. They build against the same
 * ui-kit, whose class names are already baked into its published bundle, so the
 * styles a remote needs are the ones this line loaded. A remote that imports
 * `styles.css` itself would duplicate every rule in the page for no benefit.
 */
import '@insights-platform/ui-kit/styles.css';
import './global.css';
import './shell.css';

import { App } from './App';
import { reportReactInstance } from './platform/reactIdentity';

// Announce the host's React before anything else, so it is instance #1 and any
// remote that brings its own is visibly the second.
reportReactInstance('shell');

const container = document.getElementById('root');
if (!container) throw new Error('Missing #root element in index.html');

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
