import { useEffect, useMemo, useRef, useState } from 'react';
import {
  CardGrid,
  EmptyState,
  Input,
  SectionHeader,
  Text,
} from '@insights-platform/ui-kit';
import { APPS, appsForTenant, matchesQuery, tenants } from '../registry/apps';
import type { RegisteredApp } from '../registry/apps';
import { AppCard } from './AppCard';

export interface AppDirectoryProps {
  /** The signed-in user's tenant. Their apps lead the page. */
  homeTenant: string;
  onOpened: (appId: string) => void;
}

/**
 * The directory — and on the landing page, the directory *is* the page.
 *
 * It used to share the page with a left rail listing the same apps, which is
 * two controls for one job and the oldest way to waste 260px. The rail stays on
 * `/apps/:id`, where switching between apps is a real need; here the width goes
 * to the cards, which is what people came for.
 *
 * Weight is distributed rather than spread evenly, because a flat grid of
 * everything is a catalogue and catalogues stop working somewhere around twenty
 * items:
 *
 *   1. **Your apps** — the signed-in tenant's, at full detail.
 *   2. **Other teams** — present and findable, one line of description lighter.
 *   3. **Search** — which flattens both the moment it has a query, because once
 *      you know what you want the hierarchy is in the way.
 *
 * At twenty-five apps search is the primary navigation and the groups are the
 * fallback, which is why the field sits in the section header rather than
 * below it.
 */
export function AppDirectory({ homeTenant, onOpened }: AppDirectoryProps) {
  const [query, setQuery] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);

  const mine = useMemo(() => appsForTenant(homeTenant), [homeTenant]);
  const others = useMemo(
    () => APPS.filter((app) => app.tenant !== homeTenant),
    [homeTenant],
  );
  const otherTenantCount = useMemo(
    () => tenants().filter((tenant) => tenant !== homeTenant).length,
    [homeTenant],
  );

  const results = useMemo(
    () => (query.trim() ? APPS.filter((app) => matchesQuery(app, query)) : []),
    [query],
  );

  /*
   * `/` focuses search, the convention every tool with a search box shares.
   * Not autofocus on load: this page is also read, and stealing the caret from
   * someone who arrived to look at a status line is worse than one keystroke.
   */
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== '/' || event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }
      const active = document.activeElement;
      if (
        active instanceof HTMLInputElement ||
        active instanceof HTMLTextAreaElement ||
        active instanceof HTMLSelectElement
      ) {
        return;
      }
      event.preventDefault();
      searchRef.current?.focus();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const searching = query.trim().length > 0;

  return (
    <section className="shell-directory" aria-labelledby="directory-heading">
      <SectionHeader
        as="h2"
        id="directory-heading"
        title="Applications"
        meta={`${APPS.length} across ${tenants().length} tenants`}
        actions={
          <div className="shell-search">
            <Input
              ref={searchRef}
              type="search"
              name="q"
              aria-label="Search applications by name, tenant or kind"
              placeholder="Search apps, tenants, jobs…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <kbd className="shell-kbd" aria-hidden="true">
              /
            </kbd>
          </div>
        }
      />

      {searching ? (
        <div className="shell-group">
          {/*
            `aria-live` because the results change under a caret that stays in
            the search field — a sighted user sees the list shrink, and without
            this nobody else does.
          */}
          <Text size="sm" tone="muted" aria-live="polite" className="shell-result-count">
            {results.length} result{results.length === 1 ? '' : 's'} for
            &ldquo;{query.trim()}&rdquo;
          </Text>

          {results.length === 0 ? (
            <EmptyState
              title="Nothing matches"
              description="Search covers name, tenant, description and kind."
            />
          ) : (
            <AppList apps={results} onOpened={onOpened} density="full" />
          )}
        </div>
      ) : (
        <>
          <div className="shell-group">
            <SectionHeader
              as="h3"
              size="sm"
              title="Your apps"
              meta={homeTenant}
            />

            {mine.length === 0 ? (
              <EmptyState
                title={`No apps registered for ${homeTenant}`}
                description="Other teams' apps are below."
              />
            ) : (
              <AppList apps={mine} onOpened={onOpened} density="full" />
            )}
          </div>

          {others.length > 0 ? (
            <div className="shell-group">
              <SectionHeader
                as="h3"
                size="sm"
                title="Other teams"
                meta={`${otherTenantCount} tenant${
                  otherTenantCount === 1 ? '' : 's'
                }`}
              />
              {/*
                Shown, not collapsed behind a disclosure. A directory whose
                second half is hidden sends everyone back to asking a colleague
                for a link, which is the problem the hub exists to solve. The
                cards are a density lighter instead — that is enough to say
                "yours first" without making the rest a click away.
              */}
              <AppList apps={others} onOpened={onOpened} density="compact" />
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}

function AppList({
  apps,
  onOpened,
  density,
}: {
  apps: RegisteredApp[];
  onOpened: (appId: string) => void;
  density: 'full' | 'compact';
}) {
  return (
    <CardGrid as="ul" minColumnWidth="290px" gap="lg">
      {apps.map((app) => (
        <li key={app.id}>
          <AppCard
            app={app}
            onOpened={onOpened}
            density={density}
            headingLevel="h4"
          />
        </li>
      ))}
    </CardGrid>
  );
}
