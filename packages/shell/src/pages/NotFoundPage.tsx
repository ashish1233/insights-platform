import { Card, EmptyState, Text } from '@insights-platform/ui-kit';
import { Link } from '../routing/Link';
import { HOME_PATH } from '../routing/useRoute';

/**
 * An unknown path.
 *
 * Most likely a link that outlived the app it pointed at — a tenant
 * decommissioned something and the URL is still in someone's bookmarks or a
 * three-year-old ticket. Saying so is more useful than "404", because it tells
 * the reader the problem is the link rather than their session.
 */
export function NotFoundPage({
  path,
  navigate,
}: {
  path: string;
  navigate: (next: string) => void;
}) {
  return (
    <Card title="No application at this address">
      <EmptyState
        title={<code>{path}</code>}
        description="Nothing in the registry claims this route. The app may have been decommissioned, or the link predates a rename."
      />
      <Text size="sm" tone="muted">
        <Link href={HOME_PATH} navigate={navigate} className="shell-link-inline">
          Back to all applications
        </Link>
      </Text>
    </Card>
  );
}
