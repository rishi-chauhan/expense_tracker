import React, { useState } from 'react';
import { useStatements } from '../hooks/useStatements';
import { useIsDesktop } from '../hooks/useMediaQuery';
import { useToast } from '../components/ui/Toast';
import { Card } from '../components/ui/Card';
import Button from '../components/ui/Button';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import EmptyState from '../components/ui/EmptyState';
import Skeleton from '../components/ui/Skeleton';
import { formatDay as formatTxDate } from '../utils/dataProcessing.js';
import './StatementsPage.css';

function period(stmt) {
  return `${formatTxDate(stmt.period_start, true)} to ${formatTxDate(stmt.period_end, true)}`;
}

function StatementsPage({ onChanged, onUpload }) {
  const { statements, loading, error, remove } = useStatements();
  const desktop = useIsDesktop();
  const toast = useToast();
  const [pending, setPending] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const confirmDelete = async () => {
    if (!pending) return;
    setDeleting(true);
    try {
      await remove(pending.id);
      if (onChanged) await onChanged();
      toast.show({ type: 'success', title: 'Statement deleted', message: `${pending.file_name} and its transactions were removed.` });
      setPending(null);
    } catch (err) {
      toast.show({ type: 'error', title: 'Statement not deleted', message: err.message || 'Failed to delete statement' });
    } finally {
      setDeleting(false);
    }
  };

  const count = (s) => s.transaction_count ?? s.row_count;

  let body;
  if (loading) {
    body = (
      <Card aria-busy="true" aria-label="Loading statements">
        <div className="stmt-skeleton">{[0, 1, 2].map(i => <Skeleton key={i} height={44} />)}</div>
      </Card>
    );
  } else if (error) {
    body = (
      <Card className="inline-error" role="alert">
        <span className="inline-error-text">{error}</span>
      </Card>
    );
  } else if (statements.length === 0) {
    body = (
      <Card>
        <EmptyState
          icon="statements"
          title="No statements yet"
          action={onUpload && <Button variant="primary" icon="upload" onClick={onUpload}>Upload statement</Button>}
        >
          Upload your first CSV statement to start tracking expenses.
        </EmptyState>
      </Card>
    );
  } else if (desktop) {
    body = (
      <Card className="stmt-table-card">
        <table className="stmt-table">
          <thead>
            <tr>
              <th>File</th>
              <th>Card</th>
              <th>Period</th>
              <th className="num-col">Transactions</th>
              <th>Uploaded</th>
              <th><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            {statements.map(stmt => (
              <tr key={stmt.id}>
                <td className="stmt-file" title={stmt.file_name}>{stmt.file_name}</td>
                <td>{stmt.card_label || '—'}</td>
                <td className="stmt-period">{period(stmt)}</td>
                <td className="num-col num">{count(stmt)}</td>
                <td className="stmt-muted">{stmt.uploaded_at ? formatTxDate(stmt.uploaded_at, true) : '—'}</td>
                <td className="stmt-action">
                  <Button size="sm" variant="ghost" icon="trash" onClick={() => setPending(stmt)} aria-label={`Delete ${stmt.file_name}`}>
                    Delete
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    );
  } else {
    body = (
      <ul className="stmt-cards">
        {statements.map(stmt => (
          <li key={stmt.id}>
            <Card as="article" className="stmt-card">
              <div className="stmt-card-head">
                <h2 className="stmt-card-title">{stmt.file_name}</h2>
                <Button size="sm" variant="ghost" icon="trash" onClick={() => setPending(stmt)} aria-label={`Delete ${stmt.file_name}`} />
              </div>
              <dl className="stmt-card-meta">
                <div><dt>Card</dt><dd>{stmt.card_label || '—'}</dd></div>
                <div><dt>Period</dt><dd>{period(stmt)}</dd></div>
                <div><dt>Transactions</dt><dd className="num">{count(stmt)}</dd></div>
              </dl>
            </Card>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <div className="page statements-page">
      <p className="page-intro">Every CSV you've uploaded. Deleting a statement also removes its transactions.</p>
      {body}
      <ConfirmDialog
        open={Boolean(pending)}
        title="Delete statement?"
        message={pending ? `"${pending.file_name}" and all ${count(pending)} of its transactions will be removed. This cannot be undone.` : ''}
        confirmLabel="Delete statement"
        busy={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setPending(null)}
      />
    </div>
  );
}

export default StatementsPage;
