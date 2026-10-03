import { SectionHeader, Text } from '@insights-platform/ui-kit';
import {
  ONBOARDING_DOC_URL,
  TEMPLATE_JOB_URL,
  TEMPLATE_WEB_URL,
} from '../config';

/**
 * The path for a team that has never shipped here.
 *
 * In the side column, not the main one. A new team arrives once; everyone else
 * arrives daily, and a prominent onboarding panel is a permanent tax on the
 * second group to serve the first. Findable is the correct amount of
 * prominence.
 *
 * It names the two scaffolds separately because choosing between them is the
 * first real decision a new team makes, and ADR-1 keeps them separate precisely
 * so that choice stays explicit. One "get started" link would put the fork a
 * click further away, which is where it gets guessed at.
 *
 * The copy on screen is three labels and three short lines, which is all a
 * panel in a side column can expect to be read. What it does not say, and what
 * belongs here instead: identity, authorization, scoped data access, telemetry
 * and audit all arrive from the platform, so a team that finds itself writing
 * authentication has found a gap in the platform and should report it rather
 * than work around it. That is the single most important thing to tell a new
 * team and it is also a paragraph — it belongs in ONBOARDING.md, which is what
 * the first step links to.
 */
export function GetStarted() {
  return (
    <section className="shell-panel" aria-labelledby="get-started-heading">
      <SectionHeader
        as="h2"
        size="md"
        id="get-started-heading"
        title="New team? Start here"
        description="Identity, data access and audit come from the platform. You build the app."
      />

      <ol className="shell-steps">
        <li>
          <Text as="span" size="sm" weight="semibold">
            Read the onboarding guide
          </Text>
          <Text size="sm" tone="muted">
            Day one end to end, including which tier you get and why.
          </Text>
          <a
            className="shell-link"
            href={ONBOARDING_DOC_URL}
            target="_blank"
            rel="noopener noreferrer"
          >
            ONBOARDING.md ↗
          </a>
        </li>

        <li>
          <Text as="span" size="sm" weight="semibold">
            Pick a scaffold
          </Text>
          <Text size="sm" tone="muted">
            A web app if people look at it; a job if a schedule runs it.
          </Text>
          <div className="shell-links">
            <a
              className="shell-link"
              href={TEMPLATE_WEB_URL}
              target="_blank"
              rel="noopener noreferrer"
            >
              templates/web ↗
            </a>
            <a
              className="shell-link"
              href={TEMPLATE_JOB_URL}
              target="_blank"
              rel="noopener noreferrer"
            >
              templates/job ↗
            </a>
          </div>
        </li>

        <li>
          <Text as="span" size="sm" weight="semibold">
            Ask for a tenant manifest
          </Text>
          <Text size="sm" tone="muted">
            Your app appears in this directory once it exists.
          </Text>
        </li>
      </ol>
    </section>
  );
}
