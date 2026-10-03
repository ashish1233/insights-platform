import {
  Alert,
  Button,
  Card,
  DataTable,
  EmptyState,
  Text,
  useInsights,
} from '@insights-platform/ui-kit';
import type { DataTableColumn, InsightRow } from '@insights-platform/ui-kit';
import { API_BASE_URL, DATASET_LABEL } from './config';

/**
 * TODO(template): describe your rows.
 *
 * `GET /api/insights` returns `{ id, metric, value, period }`. If your backend
 * adds fields, widen the row type here and add a column.
 */
const columns: DataTableColumn<InsightRow>[] = [
  { key: 'metric', header: 'Metric' },
  { key: 'period', header: 'Period', width: '160px' },
  { key: 'value', header: 'Value', align: 'right', width: '160px' },
];

export interface InsightsPageProps {
  token: string | null;
  onSessionExpired: () => void;
}

/** The app's one page: the rows the backend returns for this tenant. */
export function InsightsPage({ token, onSessionExpired }: InsightsPageProps) {
  const insights = useInsights({
    token,
    apiUrl: API_BASE_URL,
    onUnauthorized: onSessionExpired,
  });

  return (
    <>
      {insights.status === 'error' ? (
        <Alert
          tone="danger"
          title="Could not load data"
          action={
            <Button size="sm" variant="secondary" onClick={insights.refresh}>
              Retry
            </Button>
          }
          className="page-alert"
        >
          {insights.error}
        </Alert>
      ) : null}

      <Card
        /* TODO(template): name the page and say what the rows are. */
        title="Insights"
        description={`All ${DATASET_LABEL} available to your tenant.`}
        padding="none"
        actions={
          <Button
            size="sm"
            variant="secondary"
            onClick={insights.refresh}
            busy={insights.status === 'loading'}
          >
            Refresh
          </Button>
        }
      >
        <DataTable
          caption={`${DATASET_LABEL} for this tenant`}
          columns={columns}
          rows={insights.rows}
          getRowKey={(row) => row.id}
          loading={insights.status === 'loading'}
          empty={
            <EmptyState
              title="Nothing to show yet"
              description={`No ${DATASET_LABEL} were returned for this tenant.`}
            />
          }
        />
      </Card>

      <Text size="sm" tone="muted" style={{ marginTop: 'var(--ins-space-lg)' }}>
        Rows are scoped to your tenant by the platform SDK and the warehouse
        role. You cannot widen that scope from here.
      </Text>
    </>
  );
}
