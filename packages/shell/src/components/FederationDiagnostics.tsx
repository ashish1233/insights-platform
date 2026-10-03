import { useEffect, useState } from 'react';
import { Alert, Badge, Text } from '@insights-platform/ui-kit';
import { reactIdentityReport } from '../platform/reactIdentity';

/**
 * Shows, at runtime, how many copies of React are actually in this page.
 *
 * `shared: { react: { singleton: true } }` is a build-time request. Nothing in
 * either build fails when it is not honoured — the remote simply brings its own
 * React, every hook in it throws "Invalid hook call", and the panel goes blank.
 * A green build is not evidence here, so the shell measures the thing itself
 * and puts the number on screen where a reviewer can see it.
 *
 * It re-reads after each mount because a remote only announces itself when its
 * chunk is evaluated, which happens long after the shell's first render.
 */
export function FederationDiagnostics({ watch }: { watch: string }) {
  const [report, setReport] = useState(() => reactIdentityReport());

  useEffect(() => {
    // A remote's chunk evaluates during the Suspense resolution that follows
    // this render; a short poll is simpler than threading a callback through
    // the federation loader, and this is a diagnostic, not a feature.
    const timer = window.setInterval(
      () => setReport(reactIdentityReport()),
      500,
    );
    return () => window.clearInterval(timer);
  }, [watch]);

  const ok = report.instances === 1;

  if (!ok) {
    return (
      <Alert tone="danger" title="React is not a singleton in this page">
        {report.instances} distinct React copies are loaded (
        {report.owners.join(', ')}). Hooks in a federated remote will throw.
        Check `shared.react.singleton` and `requiredVersion` in the remote&rsquo;s
        vite config.
      </Alert>
    );
  }

  return (
    <div className="shell-diagnostics">
      <Badge tone="success">React singleton OK</Badge>
      <Text as="span" size="sm" tone="muted">
        1 React instance (v{report.versions.join(', ')}) shared by{' '}
        {report.owners.length} participant
        {report.owners.length === 1 ? '' : 's'}:{' '}
        {report.owners.map((owner, index) => (
          <span key={owner}>
            {index > 0 ? ', ' : null}
            <code>{owner}</code>
          </span>
        ))}
      </Text>
    </div>
  );
}
