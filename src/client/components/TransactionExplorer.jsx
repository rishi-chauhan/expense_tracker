import React, { useState, useMemo } from 'react';
import { formatINR } from '../utils/dataProcessing.js';
import './TransactionExplorer.css';

const PAGE_SIZE = 25;

function TransactionExplorer({ data }) {
  const [sortField, setSortField] = useState('Date');
  const [sortDir, setSortDir] = useState('desc');
  const [page, setPage] = useState(0);

  const sorted = useMemo(() => {
    if (!data || data.length === 0) return [];
    return [...data].sort((a, b) => {
      let cmp;
      if (sortField === 'Date') {
        cmp = new Date(a.Date) - new Date(b.Date);
      } else {
        cmp = a.Amount - b.Amount;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [data, sortField, sortDir]);

  const totalPages = Math.ceil(sorted.length / PAGE_SIZE);
  const pageData = sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('desc');
    }
    setPage(0);
  };

  const sortIndicator = (field) => {
    if (sortField !== field) return '';
    return sortDir === 'asc' ? ' ↑' : ' ↓';
  };

  if (!data || data.length === 0) {
    return <p className="chart-empty">No transactions to display.</p>;
  }

  return (
    <div className="tx-explorer chart-section">
      <div className="chart-header">
        <div className="chart-title-group">
          <h3>Transaction Explorer</h3>
          <p className="chart-section-subtitle">
            {sorted.length} transaction{sorted.length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      <div className="tx-table-wrapper">
        <table className="tx-table">
          <thead>
            <tr>
              <th
                className="tx-th sortable"
                onClick={() => handleSort('Date')}
              >
                Date{sortIndicator('Date')}
              </th>
              <th className="tx-th">Description</th>
              <th
                className="tx-th tx-amount sortable"
                onClick={() => handleSort('Amount')}
              >
                Amount{sortIndicator('Amount')}
              </th>
              <th className="tx-th tx-type">Type</th>
            </tr>
          </thead>
          <tbody>
            {pageData.map((tx, i) => (
              <tr key={page * PAGE_SIZE + i} className={`tx-row ${tx.IsCredit ? 'credit' : 'debit'}`}>
                <td className="tx-td tx-date">
                  {new Date(tx.Date).toLocaleDateString('en-IN', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric'
                  })}
                </td>
                <td className="tx-td tx-desc">{tx.Description}</td>
                <td className="tx-td tx-amount">
                  {formatINR(tx.Amount)}
                </td>
                <td className="tx-td tx-type">
                  <span className={`tx-badge ${tx.IsCredit ? 'credit' : 'debit'}`}>
                    {tx.IsCredit ? 'Credit' : 'Debit'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="tx-pagination">
          <button
            className="tx-page-btn"
            onClick={() => setPage(p => p - 1)}
            disabled={page === 0}
          >
            Previous
          </button>
          <span className="tx-page-info">
            Page {page + 1} of {totalPages}
          </span>
          <button
            className="tx-page-btn"
            onClick={() => setPage(p => p + 1)}
            disabled={page >= totalPages - 1}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}

export default TransactionExplorer;
