import React, { useState, useMemo, useEffect } from 'react';
import { useSettings } from '../contexts/SettingsContext';
import { formatINR } from '../utils/dataProcessing.js';
import { getCategories, setTransactionCategory } from '../utils/api.js';
import './TransactionExplorer.css';

const PAGE_SIZE = 25;

function TransactionExplorer({ data, onCategoryChange }) {
  const [sortField, setSortField] = useState('Date');
  const [sortDir, setSortDir] = useState('desc');
  const [page, setPage] = useState(0);
  const [categories, setCategories] = useState([]);
  const [savingId, setSavingId] = useState(null);
  const { showCredits } = useSettings();

  useEffect(() => {
    getCategories()
      .then((res) => setCategories(res.categories || []))
      .catch(() => setCategories([]));
  }, []);

  const displayData = useMemo(() => {
    if (!data || data.length === 0) return [];
    if (showCredits) return data;
    return data.filter(tx => !tx.IsCredit);
  }, [data, showCredits]);

  const hasMultipleCards = useMemo(() => {
    if (!data || data.length === 0) return false;
    const cardIds = new Set(data.map(tx => tx.CardId).filter(Boolean));
    return cardIds.size > 1;
  }, [data]);

  const sorted = useMemo(() => {
    if (displayData.length === 0) return [];
    return [...displayData].sort((a, b) => {
      let cmp;
      if (sortField === 'Date') {
        cmp = new Date(a.Date) - new Date(b.Date);
      } else if (sortField === 'Card') {
        cmp = (a.CardLabel || '').localeCompare(b.CardLabel || '');
      } else if (sortField === 'Category') {
        cmp = (a.CategoryName || '').localeCompare(b.CategoryName || '');
      } else {
        cmp = a.Amount - b.Amount;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [displayData, sortField, sortDir]);

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

  const handleCategorySelect = async (tx, categoryId) => {
    if (!tx.Id) return;
    setSavingId(tx.Id);
    try {
      await setTransactionCategory(tx.Id, categoryId === '' ? null : Number(categoryId));
      if (onCategoryChange) await onCategoryChange();
    } catch (err) {
      console.error('Failed to set category:', err);
    } finally {
      setSavingId(null);
    }
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
              <th className="tx-th sortable" onClick={() => handleSort('Date')}>
                Date{sortIndicator('Date')}
              </th>
              <th className="tx-th">Description</th>
              {hasMultipleCards && (
                <th className="tx-th sortable hide-sm" onClick={() => handleSort('Card')}>
                  Card{sortIndicator('Card')}
                </th>
              )}
              <th className="tx-th sortable" onClick={() => handleSort('Category')}>
                Category{sortIndicator('Category')}
              </th>
              <th className="tx-th tx-amount sortable" onClick={() => handleSort('Amount')}>
                Amount{sortIndicator('Amount')}
              </th>
              {showCredits && <th className="tx-th tx-type hide-sm">Type</th>}
            </tr>
          </thead>
          <tbody>
            {pageData.map((tx, i) => (
              <tr key={tx.Id ?? (page * PAGE_SIZE + i)} className={`tx-row ${tx.IsCredit ? 'credit' : 'debit'}`}>
                <td className="tx-td tx-date" data-label="Date">
                  {new Date(tx.Date).toLocaleDateString('en-IN', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric'
                  })}
                </td>
                <td className="tx-td tx-desc" data-label="Description">{tx.Description}</td>
                {hasMultipleCards && (
                  <td className="tx-td tx-card hide-sm" data-label="Card">{tx.CardLabel || ''}</td>
                )}
                <td className="tx-td tx-category" data-label="Category">
                  <select
                    className="tx-category-select"
                    value={tx.CategoryId ?? ''}
                    disabled={savingId === tx.Id || !tx.Id}
                    onChange={(e) => handleCategorySelect(tx, e.target.value)}
                    aria-label={`Category for ${tx.Description}`}
                  >
                    <option value="">Uncategorized</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </td>
                <td className="tx-td tx-amount" data-label="Amount">
                  {formatINR(tx.Amount)}
                </td>
                {showCredits && (
                  <td className="tx-td tx-type hide-sm" data-label="Type">
                    <span className={`tx-badge ${tx.IsCredit ? 'credit' : 'debit'}`}>
                      {tx.IsCredit ? 'Credit' : 'Debit'}
                    </span>
                  </td>
                )}
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
