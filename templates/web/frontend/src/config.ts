/**
 * Everything a new team has to fill in lives here.
 *
 * Search the scaffold for `TODO(template)` — this file holds all of them except
 * the page `<title>` in `index.html`.
 */

/** TODO(template): the app's display name, shown in the header and on sign-in. */
export const APP_NAME = 'Insights App';

/** TODO(template): one line describing what this app reports on. */
export const APP_DESCRIPTION = 'Reporting app built on the Insights Hub platform.';

/**
 * TODO(template): your tenant id, as registered with the platform team.
 *
 * This only pre-fills the sign-in form. It is not a security control: the
 * backend takes the tenant from the token, never from the frontend.
 */
export const TENANT_ID = 'your-tenant-id';

/**
 * TODO(template): the scopes this app needs.
 *
 * Ask for the narrowest set that works. `insights:read` is enough for a
 * standard-tier app reading non-sensitive rows.
 */
export const SCOPES = ['insights:read'];

/**
 * TODO(template): what the table is showing — used as the table's accessible
 * caption and in its empty state.
 */
export const DATASET_LABEL = 'insight rows';

/** Backend base URL. Override with `VITE_API_BASE_URL` per environment. */
export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000';

/** Identity service base URL. Override with `VITE_IDENTITY_BASE_URL`. */
export const IDENTITY_BASE_URL =
  import.meta.env.VITE_IDENTITY_BASE_URL ?? 'http://localhost:8081';
