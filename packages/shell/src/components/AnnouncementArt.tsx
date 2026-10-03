import type { ReactElement } from 'react';
import type { AnnouncementArtKey } from '../registry/announcements';

/**
 * The small mark beside an announcement.
 *
 * Drawn in SVG from the kit's tokens rather than fetched or committed as a
 * binary, for three reasons that all point the same way: the repository stays
 * text-only and diffable, the page works with no network, and an announcement
 * cannot arrive carrying an uncompressed photograph nobody looked at.
 *
 * They are abstract on purpose. A spot illustration of a *thing* — a server, a
 * clipboard, a person at a laptop — is a stock-photo gesture in vector form: it
 * adds nothing a reader did not get from the title and dates the page the
 * moment the house style moves. These are four geometric marks in the token
 * palette whose only job is to give each announcement a stable silhouette, so
 * that paging back to the migration notice is recognising a shape rather than
 * re-reading a heading.
 *
 * `aria-hidden` throughout, and that is not laziness: every one of them is a
 * restatement of the title directly beside it, so describing them to a screen
 * reader would be making someone listen to the same sentence twice.
 */
export function AnnouncementArt({ art }: { art: AnnouncementArtKey }) {
  return (
    <svg
      className="shell-ann-art"
      viewBox="0 0 96 96"
      role="presentation"
      aria-hidden="true"
      focusable="false"
    >
      {ART[art]}
    </svg>
  );
}

/*
 * One shared vocabulary across all four: 8px-radius rounded rectangles on a
 * 16px grid, 2px strokes, and exactly one accent element per mark. Keeping the
 * grammar identical is what makes four different drawings read as one set.
 */
const ART: Record<AnnouncementArtKey, ReactElement> = {
  /* Two stacks, and the move between them. */
  migration: (
    <g fill="none" strokeWidth="2">
      <rect
        x="8"
        y="24"
        width="28"
        height="48"
        rx="6"
        fill="var(--ins-color-surface-sunken)"
        stroke="var(--ins-color-border-strong)"
      />
      <rect
        x="60"
        y="24"
        width="28"
        height="48"
        rx="6"
        fill="var(--ins-color-primary-surface)"
        stroke="var(--ins-color-primary)"
      />
      <path
        d="M40 48h14"
        stroke="var(--ins-color-primary)"
        strokeLinecap="round"
      />
      <path
        d="M50 43l5 5-5 5"
        stroke="var(--ins-color-primary)"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M16 36h12M16 48h12M16 60h12"
        stroke="var(--ins-color-border-strong)"
        strokeLinecap="round"
      />
    </g>
  ),

  /* Rows arriving in a table; the newest one is the accent. */
  dataset: (
    <g fill="none" strokeWidth="2">
      <rect
        x="12"
        y="16"
        width="72"
        height="64"
        rx="8"
        fill="var(--ins-color-surface-sunken)"
        stroke="var(--ins-color-border-strong)"
      />
      <path
        d="M12 34h72"
        stroke="var(--ins-color-border-strong)"
        strokeLinecap="round"
      />
      <rect
        x="22"
        y="44"
        width="30"
        height="6"
        rx="3"
        fill="var(--ins-color-border-strong)"
        stroke="none"
      />
      <rect
        x="22"
        y="58"
        width="44"
        height="6"
        rx="3"
        fill="var(--ins-color-success)"
        stroke="none"
      />
      <rect
        x="62"
        y="44"
        width="12"
        height="6"
        rx="3"
        fill="var(--ins-color-border-strong)"
        stroke="none"
      />
    </g>
  ),

  /* A line that dipped and came back. Not a jagged alarm glyph — the incident
     is over, and the mark should say "here is what happened", not "run". */
  incident: (
    <g fill="none" strokeWidth="2">
      <rect
        x="10"
        y="18"
        width="76"
        height="60"
        rx="8"
        fill="var(--ins-color-surface-sunken)"
        stroke="var(--ins-color-border-strong)"
      />
      <path
        d="M20 40h14l8 22 8-38 7 16h19"
        stroke="var(--ins-color-warning)"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle
        cx="50"
        cy="24"
        r="3.5"
        fill="var(--ins-color-warning)"
        stroke="none"
      />
    </g>
  ),

  /* The outgoing ring is dashed; the one replacing it is solid. */
  deprecation: (
    <g fill="none" strokeWidth="2">
      <circle
        cx="48"
        cy="48"
        r="30"
        stroke="var(--ins-color-border-strong)"
        strokeDasharray="5 6"
        strokeLinecap="round"
      />
      <circle
        cx="48"
        cy="48"
        r="17"
        fill="var(--ins-color-restricted-surface)"
        stroke="var(--ins-color-restricted)"
      />
      <path
        d="M48 40v10"
        stroke="var(--ins-color-restricted)"
        strokeLinecap="round"
      />
      <circle
        cx="48"
        cy="56"
        r="1.75"
        fill="var(--ins-color-restricted)"
        stroke="none"
      />
    </g>
  ),
};
