export const APP_NAME = 'Insights Hub';

export const APP_DESCRIPTION =
  'One sign-in for every app on the platform. Restricted-tier apps keep their own.';

/**
 * The shell signs in against the same identity service as the apps, and stores
 * the session under a key the apps also use. That shared session is most of the
 * value of federating at all.
 *
 * It is also the clearest statement of what federation costs: every mounted
 * remote runs on this origin and can read this token out of `localStorage`.
 * ADR-2 accepts that between colleagues, and refuses it for compensation data —
 * which is why the restricted app is not here to read it.
 */
export const IDENTITY_BASE_URL =
  import.meta.env.VITE_IDENTITY_BASE_URL ?? 'http://localhost:8081';

/** Warehouse and audit are never called by the shell — only health-checked. */
export const WAREHOUSE_BASE_URL =
  import.meta.env.VITE_WAREHOUSE_BASE_URL ?? 'http://localhost:8082';

export const AUDIT_BASE_URL =
  import.meta.env.VITE_AUDIT_BASE_URL ?? 'http://localhost:8083';

/** The shell asks for nothing beyond ordinary read access on its own behalf. */
export const SCOPES = ['insights:read'];

/**
 * The SDK version the platform currently ships.
 *
 * Hardcoded, and that is a known wart: it duplicates
 * `insights-sdk-python/pyproject.toml` and will go stale the first time nobody
 * remembers. It belongs in the registry response the platform serves, next to
 * the app list, where one deploy updates both.
 */
export const PLATFORM_SDK_VERSION = '0.1.0';

/** Where a team that has never shipped on the platform should go first. */
export const ONBOARDING_DOC_URL =
  'https://github.com/ashish1233/insights-platform/blob/main/ONBOARDING.md';

export const TEMPLATE_WEB_URL =
  'https://github.com/ashish1233/insights-platform/tree/main/templates/web';

export const TEMPLATE_JOB_URL =
  'https://github.com/ashish1233/insights-platform/tree/main/templates/job';
