import { Badge, LinkCard, MetaRow, Text } from '@insights-platform/ui-kit';
import { isFederated, isJob } from '../registry/apps';
import type { RegisteredApp, ScheduledJob } from '../registry/apps';
import { useRegisteredAppHealth } from '../health/HealthProvider';

/**
 * One app in the directory, and the whole card is the link.
 *
 * Not a card with an "Open ↗" link in the corner. The earlier version had a
 * title link *and* a separate open link, which is two tab stops and two hit
 * targets to say one thing — and at twenty-five apps, fifty tab stops to cross
 * a directory. One anchor wrapping the card gives a 280×150px target instead of
 * a 40px one, and because it is a real `<a href target="_blank">`, ⌘-click,
 * middle-click, "copy link address" and the browser's status bar all keep
 * working. In a tool people keep a dozen tabs of, opening three reports side by
 * side is the normal way to use it.
 *
 * Three treatments, structural rather than decorative:
 *
 *   - **Standard, federated** — ordinary card. Opens a route on the hub's own
 *     origin, where the remote mounts inside the hub's chrome.
 *   - **Restricted** — an ochre rule down the left edge (ADR-2 made visible,
 *     and the load-bearing part of this design). Opens the app's *own* origin.
 *     A reader should know it leaves the hub before reading the label.
 *   - **Job** — no anchor at all, and a dashed inert surface. Schedule and last
 *     run instead of a status. A disabled button would imply a permission the
 *     reader might go and obtain; there is simply nothing on the other side.
 */

const DATE_TIME = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'UTC',
});

/**
 * The job's two facts: when it runs, and how the last one went.
 *
 * A green dot would answer neither. "Did last night's job run" is the question
 * an owner came with, and a time plus an outcome answers it.
 */
function jobStatus(job: ScheduledJob): JobStatus {
  const run = job.lastRun;
  if (!run) {
    return { text: 'No run recorded', failed: false, sample: false };
  }

  return {
    text: `Last run ${DATE_TIME.format(new Date(run.finishedAt))} UTC — ${
      run.outcome
    }, ${run.rowsExported.toLocaleString('en-GB')} rows`,
    failed: run.outcome === 'failed',
    // The job harness publishes no run history the shell can read (see
    // ScheduledJob.lastRun). Labelled every single time it is shown — an
    // unlabelled plausible number is worse than no number.
    sample: true,
  };
}

interface JobStatus {
  text: string;
  failed: boolean;
  sample: boolean;
}

/**
 * The health half of an app's metadata row.
 *
 * Healthy is quiet — the word "Healthy" in muted grey, no dot, no green. Only
 * an exception earns a colour, and `not-measured` is not an exception: it is
 * the designed state of an app whose backend will never answer this origin, so
 * it reads as a neutral note about *who measured*, not as a failure. See
 * `healthIsBrowserReadable`.
 */
function HealthNote({ app }: { app: RegisteredApp }) {
  const { state, health, error } = useRegisteredAppHealth(app.id);

  if (state === 'not-measured') {
    return (
      <Text as="span" size="sm" tone="muted">
        Status reported by the platform, not the hub
      </Text>
    );
  }

  if (state === 'loading') {
    return (
      <Text as="span" size="sm" tone="muted">
        Checking…
      </Text>
    );
  }

  if (state === 'ok') {
    return (
      <Text as="span" size="sm" tone="muted">
        Healthy{health ? ` · SDK ${health.sdk_version}` : ''}
      </Text>
    );
  }

  if (state === 'tier-mismatch') {
    return (
      <Text as="span" size="sm" tone="danger" weight="medium">
        Tier mismatch — reports &ldquo;{health?.tier}&rdquo;
      </Text>
    );
  }

  return (
    <Text as="span" size="sm" tone="danger" weight="medium">
      Not responding{error ? ` — ${error}` : ''}
    </Text>
  );
}

export interface AppCardProps {
  app: RegisteredApp;
  /** Present for callers that still navigate in-page. Cards open a new tab. */
  navigate?: (path: string) => void;
  onOpened?: (appId: string) => void;
  /** Heading level, chosen by the caller because only it knows the outline. */
  headingLevel?: 'h2' | 'h3' | 'h4';
  /**
   * `full` shows the description — used where the reader came to look at
   * detail. `compact` drops it for the long tail of other teams' apps they are
   * scanning past. Both keep the metadata row: it is the cheapest line on the
   * card and the one that answers "is this the right one".
   */
  density?: 'full' | 'compact';
}

export function AppCard({
  app,
  onOpened,
  headingLevel = 'h3',
  density = 'full',
}: AppCardProps) {
  const restricted = app.tier === 'restricted';
  const job = isJob(app);

  /*
   * Two rows, not one, and the split is by kind of fact rather than by length:
   * what this app *is* (tenant, tier) is stable, and how it is *doing* changes
   * under you. Putting all three on one line also wrapped the health clause at
   * card width, which left a separator stranded at the start of a line looking
   * like a rendering fault.
   */
  const meta = job ? (
    <JobMeta job={app} />
  ) : (
    <div className="shell-card-meta">
      <MetaRow
        items={[
          <span className="shell-mono">{app.tenant}</span>,
          restricted ? 'Restricted tier' : 'Standard tier',
        ]}
      />
      <HealthNote app={app} />
    </div>
  );

  if (job) {
    return (
      <LinkCard
        title={app.name}
        description={density === 'full' ? app.description : undefined}
        badges={<Badge tone="neutral">Scheduled job</Badge>}
        meta={meta}
        headingLevel={headingLevel}
        accent="inert"
      />
    );
  }

  /*
   * The one place "open this app" is decided, and the user-visible behaviour is
   * identical across tiers — click, and the app is in a new tab. ADR-2's split
   * is about where the code runs, not about what the person clicking has to
   * understand.
   *
   * `noopener` goes on both branches rather than only the restricted one. It is
   * load-bearing there — without it the opened window keeps a handle back
   * through `window.opener`, which is a thread between two origins that exist
   * precisely so there is no thread — and a security attribute that depends on
   * a branch is one a refactor quietly removes.
   */
  const href = isFederated(app) ? app.route : app.href;

  return (
    <LinkCard
      title={app.name}
      description={density === 'full' ? app.description : undefined}
      badges={restricted ? <Badge tone="restricted">Restricted</Badge> : null}
      meta={meta}
      headingLevel={headingLevel}
      accent={restricted ? 'restricted' : 'none'}
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      linkHint={
        restricted
          ? 'opens in a new tab, on its own origin'
          : 'opens in a new tab'
      }
      // Recorded here as well as on arrival, so the recents list in the tab
      // being left behind updates rather than going stale.
      onClick={() => onOpened?.(app.id)}
    />
  );
}

function JobMeta({ job }: { job: ScheduledJob }) {
  const status = jobStatus(job);

  return (
    <div className="shell-card-meta">
      {/* No "nothing to open" line — the card having no affordance and no
          surface already says it, and saying it twice is noise. */}
      <MetaRow
        items={[
          <span className="shell-mono">{job.tenant}</span>,
          job.scheduleLabel,
        ]}
      />
      <MetaRow
        items={[
          <Text as="span" size="sm" tone={status.failed ? 'danger' : 'muted'}>
            {status.text}
          </Text>,
          status.sample ? <Badge tone="neutral">sample data</Badge> : null,
        ]}
      />
    </div>
  );
}
