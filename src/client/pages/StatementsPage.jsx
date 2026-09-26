import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useStatements } from '../hooks/useStatements';
import './StatementsPage.css';

function StatementsPage({ onChanged }) {
  const { statements, loading, error, remove } = useStatements();
  const [deletingId, setDeletingId] = useState(null);
  const [actionError, setActionError] = useState(null);

  const handleDelete = async (stmt) => {
    const label = stmt.file_name || `statement #${stmt.id}`;
    if (!window.confirm(`Delete "${label}" and all its transactions? This cannot be undone.`)) {
      return;
    }
    setDeletingId(stmt.id);
    setActionError(null);
    try {
      await remove(stmt.id);
      if (onChanged) await onChanged();
    } catch (err) {
      setActionError(err.message || 'Failed to delete statement');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="statements-page">
      <div className="statements-header">
        <h2>Statements</h2>
        <p className="statements-subtitle">Manage uploaded credit card statements</p>
      </div>

      {(error || actionError) && (
        <div className="statements-error" role="alert">{error || actionError}</div>
      )}

      {loading ? (
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <div className="loading-text">Loading statements...</div>
        </div>
      ) : statements.length === 0 ? (
        <div className="statements-empty">
          <div className="statements-empty-icon" aria-hidden="true">↑</div>
          <h3>No statements yet</h3>
          <p>Upload your first CSV statement to start tracking expenses.</p>
          <Link to="/">Upload a statement</Link>
        </div>
      ) : (
        <div className="statements-table-wrap">
          <table className="statements-table">
            <thead>
              <tr>
                <th>File</th>
                <th>Card</th>
                <th>Period</th>
                <th>Rows</th>
                <th>Uploaded</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {statements.map((stmt) => (
                <tr key={stmt.id}>
                  <td className="stmt-file">{stmt.file_name}</td>
                  <td>{stmt.card_label || '—'}</td>
                  <td className="stmt-period">
                    {stmt.period_start} → {stmt.period_end}
                  </td>
                  <td>{stmt.transaction_count ?? stmt.row_count}</td>
                  <td>
                    {stmt.uploaded_at
                      ? new Date(stmt.uploaded_at).toLocaleDateString('en-IN')
                      : '—'}
                  </td>
                  <td>
                    <button
                      type="button"
                      className="stmt-delete-btn"
                      onClick={() => handleDelete(stmt)}
                      disabled={deletingId === stmt.id}
                    >
                      {deletingId === stmt.id ? 'Deleting…' : 'Delete'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default StatementsPage;
