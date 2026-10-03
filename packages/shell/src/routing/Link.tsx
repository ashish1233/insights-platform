import type { AnchorHTMLAttributes, MouseEvent, ReactNode } from 'react';

export interface LinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  href: string;
  /** Client-side navigation for a plain left-click. Omit for a hard link. */
  navigate?: (path: string) => void;
  children: ReactNode;
}

/**
 * A real anchor that also does client-side navigation.
 *
 * The ordering matters and is easy to get backwards: the element is an `<a>`
 * with a genuine `href` first, and the SPA behaviour is an enhancement layered
 * on a plain left-click. Written the other way round — a `<button onClick>` or
 * an anchor with `href="#"` — the browser loses middle-click, ⌘-click, "open in
 * new tab", "copy link address", and the status bar that tells you where you
 * are about to go. Those are not nice-to-haves in a tool someone keeps a dozen
 * tabs of.
 *
 * Every modifier combination is allowed through to the browser untouched,
 * including `target="_blank"`, which is how the directory opens apps.
 */
export function Link({ href, navigate, onClick, children, ...rest }: LinkProps) {
  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(event);

    if (!navigate) return;
    if (event.defaultPrevented) return;
    // Left button only; anything else is the user asking for browser behaviour.
    if (event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (rest.target && rest.target !== '_self') return;

    event.preventDefault();
    navigate(href);
  };

  return (
    <a {...rest} href={href} onClick={handleClick}>
      {children}
    </a>
  );
}
