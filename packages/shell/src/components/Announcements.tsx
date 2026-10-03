import { Badge, Carousel, MetaRow, Text } from '@insights-platform/ui-kit';
import type { CarouselItem } from '@insights-platform/ui-kit';
import { ANNOUNCEMENTS } from '../registry/announcements';
import type { Announcement } from '../registry/announcements';
import { AnnouncementArt } from './AnnouncementArt';

const DATE_FORMAT = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

/**
 * What the platform team is saying to its tenants this month.
 *
 * It sits above the directory because it is the one thing on this page the
 * reader did not come looking for — a migration window is only useful if it
 * reaches someone whose plan for the weekend does not yet include it. Below the
 * directory it would be read by nobody, and the entire point of having a
 * channel is that it is read.
 *
 * It is also kept to the height of one item, which is the compromise that makes
 * the position defensible. A daily user is here for the directory; a panel
 * above it is a tax they pay every morning, so the tax is one row of furniture
 * and never a screen of it. No hero, no auto-rotation, and the controls sit
 * below the text rather than floating over it.
 *
 * Advancing is manual — see `Carousel`, which refuses to grow an `autoPlay`
 * prop and explains why.
 */
export function Announcements() {
  if (ANNOUNCEMENTS.length === 0) return null;

  const items: CarouselItem[] = ANNOUNCEMENTS.map((entry) => ({
    id: entry.id,
    label: entry.title,
    content: <AnnouncementSlide entry={entry} />,
  }));

  return (
    <Carousel
      label="Platform announcements"
      itemNoun="announcement"
      items={items}
      /*
       * Reserves the height of the longest entry so paging does not move the
       * directory underneath. Measured against the current four; it is a
       * minimum, so a longer one grows rather than clipping.
       */
      minHeight="188px"
      className="shell-announcements"
    />
  );
}

function AnnouncementSlide({ entry }: { entry: Announcement }) {
  return (
    <article className="shell-ann">
      {entry.art ? (
        <div className="shell-ann-figure">
          <AnnouncementArt art={entry.art} />
        </div>
      ) : null}

      <div className="shell-ann-body">
        <MetaRow
          className="shell-ann-meta"
          items={[
            <Text as="span" size="xs" weight="semibold" className="shell-eyebrow">
              {entry.category}
            </Text>,
            <time dateTime={entry.date}>
              {DATE_FORMAT.format(new Date(entry.date))}
            </time>,
            /*
             * The only colour in the panel, and it is spent on the one
             * distinction that changes what the reader does: this entry has a
             * date they have to act before. Everything else is type.
             */
            entry.tone === 'attention' ? (
              <Badge tone="warning">Action needed</Badge>
            ) : null,
          ]}
        />

        {/*
          h2, same level as "Applications" and "What's new".

          The region is a top-level section of the page, so its one visible
          title has to be a top-level heading — an h3 here would follow the
          `h1` directly and skip a level, which is a real defect for anyone
          navigating by headings rather than a style preference. The carousel's
          own `aria-label` names the region; this names what is in it.

          Only the current slide is in the DOM, so the outline never collects
          four sibling h2s the reader cannot see.
        */}
        <Text as="h2" size="lg" weight="semibold">
          {entry.title}
        </Text>

        <Text size="sm" tone="muted" className="shell-ann-text">
          {entry.body}
        </Text>

        {entry.link ? (
          /*
           * Outside the slide's own click target on purpose: the panel is not
           * a card-sized link, and a region that is entirely one anchor cannot
           * also hold the previous/next buttons.
           */
          <a
            className="shell-link"
            href={entry.link.href}
            target="_blank"
            rel="noopener noreferrer"
          >
            {entry.link.label}
            <span aria-hidden="true"> ↗</span>
          </a>
        ) : null}
      </div>
    </article>
  );
}
