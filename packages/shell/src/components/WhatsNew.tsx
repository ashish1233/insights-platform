import { Badge, SectionHeader, Text } from '@insights-platform/ui-kit';
import { RELEASES } from '../registry/releases';

const DATE_FORMAT = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

/**
 * The changelog feed.
 *
 * Four entries, newest first, no pagination. The job of this panel is to answer
 * "is anyone still looking after this?" in about two seconds, and a long
 * scrolling feed answers a question nobody asked while burying the one entry
 * that needed action.
 *
 * The **what you need to do** line is the part that earns the space. A release
 * note that does not say what the reader must change is a release note nobody
 * reads twice, and after that the platform team has no channel left. The
 * deprecation deadline is the most convincing item on the page for the same
 * reason: it is a commitment with a date on it.
 */
export function WhatsNew() {
  return (
    <section className="shell-panel" aria-labelledby="whats-new-heading">
      <SectionHeader
        as="h2"
        size="md"
        id="whats-new-heading"
        title="What&rsquo;s new"
        description="Changes to the SDK and the kit that affect the apps you own."
      />

      <ol className="shell-feed">
        {RELEASES.map((entry) => (
          <li key={`${entry.component}-${entry.date}`} className="shell-feed-item">
            <div className="shell-feed-meta">
              <Text as="span" size="xs" weight="medium" className="shell-eyebrow">
                {entry.component}
                {entry.version ? ` ${entry.version}` : ''}
              </Text>
              <Text as="span" size="xs" tone="muted">
                <time dateTime={entry.date}>
                  {DATE_FORMAT.format(new Date(entry.date))}
                </time>
              </Text>
            </div>

            <Text as="h3" size="md" weight="semibold">
              {entry.title}
            </Text>
            <Text size="sm" tone="muted">
              {entry.summary}
            </Text>

            {entry.action ? (
              <Text size="sm" className="shell-feed-action">
                <strong>What to do:</strong> {entry.action}
              </Text>
            ) : null}

            {entry.deadline ? (
              <div className="shell-feed-deadline">
                <Badge tone="warning">Deadline</Badge>
                <Text as="span" size="xs" tone="muted">
                  {entry.deadline}
                </Text>
              </div>
            ) : null}
          </li>
        ))}
      </ol>
    </section>
  );
}
