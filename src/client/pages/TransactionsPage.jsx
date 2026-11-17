import React, { useDeferredValue, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useFilters } from '../contexts/FilterContext';
import { useSettings } from '../contexts/SettingsContext';
import { useCategories } from '../hooks/useCategories';
import { useIsDesktop } from '../hooks/useMediaQuery';
import { setTransactionCategory, exportTransactions } from '../utils/api.js';
import { searchByDescription } from '../utils/dataProcessing.js';
import { useToast } from '../components/ui/Toast';
import TransactionRow from '../components/TransactionRow';
import { formatDay as formatTxDate } from '../utils/dataProcessing.js';
import { Card } from '../components/ui/Card';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import SegmentedControl from '../components/ui/SegmentedControl';
import Button from '../components/ui/Button';
import Amount from '../components/ui/Amount';
import Sheet from '../components/ui/Sheet';
import EmptyState from '../components/ui/EmptyState';
import '../components/TransactionRow.css';
import './TransactionsPage.css';

export const PAGE_SIZE = 50;
const UNCATEGORISED = '#8b90a0';

const SORTERS = {
  Date: (a, b) => (a.Ts ?? new Date(a.Date).getTime()) - (b.Ts ?? new Date(b.Date).getTime()),
  Description: (a, b) => (a.Description || '').localeCompare(b.Description || ''),
  Card: (a, b) => (a.CardLabel || '').localeCompare(b.CardLabel || ''),
  Category: (a, b) => (a.CategoryName || '').localeCompare(b.CategoryName || ''),
  Amount: (a, b) => a.Amount - b.Amount,
};

function CategorySelect({ tx, categories, saving, onChange, label }) {
  return (
    <select
      className="select tx-cat-select"
      aria-label={label || `Category for ${tx.Description}`}
      value={tx.CategoryId ?? ''}
      disabled={saving}
      onChange={(e) => onChange(tx, e.target.value)}
    >
      <option value="">Uncategorised</option>
      {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
    </select>
  );
}

export default function TransactionsPage({ cards = [], onCategoryChange }) {
  const { filtered, range, cardId } = useFilters();
  const { showCredits } = useSettings();
  const { categories } = useCategories();
  const desktop = useIsDesktop();
  const toast = useToast();
  const [params, setParams] = useSearchParams();

  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);
  const [type, setType] = useState('all');
  const [sort, setSort] = useState({ field: 'Date', dir: 'desc' });
  const [page, setPage] = useState(0);
  const [visible, setVisible] = useState(PAGE_SIZE);
  const [savingId, setSavingId] = useState(null);
  const [selected, setSelected] = useState(null);
  const [exporting, setExporting] = useState(false);

  const categoryParam = params.get('category') || '';
  const multiCard = cards.length > 1;

  const setCategoryFilter = (value) => {
    setParams(prev => {
      const next = new URLSearchParams(prev);
      if (value) next.set('category', value);
      else next.delete('category');
      return next;
    }, { replace: true });
    setPage(0);
    setVisible(PAGE_SIZE);
  };

  const rows = useMemo(() => {
    let out = filtered;
    if (!showCredits) out = out.filter(t => !t.IsCredit);
    else if (type !== 'all') out = out.filter(t => (type === 'credit' ? t.IsCredit : !t.IsCredit));
    if (categoryParam === 'none') out = out.filter(t => t.CategoryId == null);
    else if (categoryParam) out = out.filter(t => String(t.CategoryId) === categoryParam);
    out = searchByDescription(out, deferredQuery);
    const cmp = SORTERS[sort.field] || SORTERS.Date;
    const dir = sort.dir === 'asc' ? 1 : -1;
    return [...out].sort((a, b) => dir * cmp(a, b) || dir * ((a.Id ?? 0) - (b.Id ?? 0)));
  }, [filtered, showCredits, type, categoryParam, deferredQuery, sort]);

  const total = useMemo(() => rows.reduce((s, t) => s + (t.IsCredit ? 0 : t.Amount), 0), [rows]);
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages - 1);
  const pageRows = desktop
    ? rows.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE)
    : rows.slice(0, visible);

  const toggleSort = (field) => {
    setSort(prev => (prev.field === field
      ? { field, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
      : { field, dir: field === 'Date' || field === 'Amount' ? 'desc' : 'asc' }));
    setPage(0);
  };

  const changeCategory = async (tx, value) => {
    const categoryId = value === '' ? null : Number(value);
    setSavingId(tx.Id);
    try {
      await setTransactionCategory(tx.Id, categoryId);
      if (onCategoryChange) await onCategoryChange();
      const name = categories.find(c => c.id === categoryId)?.name || 'Uncategorised';
      setSelected(sel => (sel && sel.Id === tx.Id ? { ...sel, CategoryId: categoryId, CategoryName: name } : sel));
      toast.show({ type: 'success', title: 'Category updated', message: `${tx.Description} is now ${name}.` });
    } catch (err) {
      toast.show({ type: 'error', title: 'Category not changed', message: err.message || 'Try again.' });
    } finally {
      setSavingId(null);
    }
  };

  const onExport = async () => {
    setExporting(true);
    try {
      await exportTransactions({
        cardId: cardId || undefined,
        startDate: range.from || undefined,
        endDate: range.to || undefined,
        categoryId: categoryParam && categoryParam !== 'none' ? categoryParam : undefined,
      });
    } catch (err) {
      toast.show({ type: 'error', title: 'Export failed', message: err.message || 'Try again.' });
    } finally {
      setExporting(false);
    }
  };

  const sortHeader = (field, label, className = '') => {
    const active = sort.field === field;
    return (
      <th
        className={`tx-th ${className}`.trim()}
        aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
      >
        <button type="button" className="tx-sort-btn" onClick={() => toggleSort(field)}>
          {label}
          <span className="tx-sort-ind" aria-hidden="true">{active ? (sort.dir === 'asc' ? '↑' : '↓') : ''}</span>
        </button>
      </th>
    );
  };

  return (
    <div className="page transactions-page">
      <div className="tx-toolbar">
        <Input
          label="Search transactions"
          hideLabel
          icon="search"
          type="search"
          placeholder="Search merchants"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setPage(0); setVisible(PAGE_SIZE); }}
          className="tx-search"
        />
        <Select
          label="Category"
          hideLabel
          value={categoryParam}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="tx-cat-filter"
        >
          <option value="">All categories</option>
          <option value="none">Uncategorised</option>
          {categories.map(c => <option key={c.id} value={String(c.id)}>{c.name}</option>)}
        </Select>
        {showCredits && (
          <SegmentedControl
            label="Type"
            value={type}
            onChange={(v) => { setType(v); setPage(0); }}
            options={[{ value: 'all', label: 'All' }, { value: 'debit', label: 'Debits' }, { value: 'credit', label: 'Credits' }]}
          />
        )}
        <Button icon="download" onClick={onExport} loading={exporting} className="tx-export">Export CSV</Button>
      </div>

      <p className="tx-summary" aria-live="polite">
        <span className="num">{rows.length.toLocaleString('en-IN')}</span> transaction{rows.length === 1 ? '' : 's'}
        {rows.length > 0 && <>, <Amount value={total} /> spent</>}
      </p>

      {rows.length === 0 ? (
        <Card>
          <EmptyState icon="search" title="No matching transactions">
            Change the search, category or period to see more.
          </EmptyState>
        </Card>
      ) : desktop ? (
        <Card className="tx-table-card">
          <div className="tx-table-wrap">
            <table className="tx-table">
              <thead>
                <tr>
                  {sortHeader('Date', 'Date', 'tx-col-date')}
                  {sortHeader('Description', 'Description')}
                  {multiCard && sortHeader('Card', 'Card', 'tx-col-card')}
                  {sortHeader('Category', 'Category', 'tx-col-cat')}
                  {sortHeader('Amount', 'Amount', 'tx-col-amount')}
                </tr>
              </thead>
              <tbody>
                {pageRows.map(tx => (
                  <tr key={tx.Id ?? `${tx.DateStr}-${tx.Description}-${tx.Amount}`}>
                    <td className="tx-col-date">{formatTxDate(tx.Date, true)}</td>
                    <td className="tx-col-desc" title={tx.Description}>{tx.Description}</td>
                    {multiCard && <td className="tx-col-card">{tx.CardLabel || '—'}</td>}
                    <td className="tx-col-cat">
                      <span className="tx-cat-cell">
                        <span className="tx-row-dot" style={{ background: tx.CategoryColor || UNCATEGORISED }} aria-hidden="true" />
                        {tx.Id != null ? (
                          <CategorySelect tx={tx} categories={categories} saving={savingId === tx.Id} onChange={changeCategory} />
                        ) : (tx.CategoryName || 'Uncategorised')}
                      </span>
                    </td>
                    <td className="tx-col-amount">
                      <Amount value={tx.Amount} credit={tx.IsCredit} tone={tx.IsCredit ? 'credit' : 'plain'} sign={tx.IsCredit} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <nav className="tx-pagination" aria-label="Pages">
              <Button size="sm" onClick={() => setPage(p => Math.max(0, p - 1))} disabled={currentPage === 0}>Previous</Button>
              <span className="tx-page-info">Page {currentPage + 1} of {totalPages}</span>
              <Button size="sm" onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={currentPage >= totalPages - 1}>Next</Button>
            </nav>
          )}
        </Card>
      ) : (
        <Card className="tx-list-card">
          <ul className="tx-list">
            {pageRows.map(tx => (
              <TransactionRow key={tx.Id ?? `${tx.DateStr}-${tx.Description}-${tx.Amount}`} tx={tx} showCard={multiCard} onSelect={setSelected} />
            ))}
          </ul>
          {visible < rows.length && (
            <Button className="tx-load-more" onClick={() => setVisible(v => v + PAGE_SIZE)}>
              Load {Math.min(PAGE_SIZE, rows.length - visible)} more
            </Button>
          )}
        </Card>
      )}

      <Sheet open={Boolean(selected)} onClose={() => setSelected(null)} title={selected?.Description || 'Transaction'}>
        {selected && (
          <div className="tx-detail">
            <Amount value={selected.Amount} credit={selected.IsCredit} tone={selected.IsCredit ? 'credit' : 'plain'} sign={selected.IsCredit} className="tx-detail-amount" />
            <dl className="tx-detail-list">
              <div><dt>Date</dt><dd>{formatTxDate(selected.Date, true)}</dd></div>
              <div><dt>Type</dt><dd>{selected.IsCredit ? 'Credit' : 'Debit'}{selected.Type ? `, ${selected.Type}` : ''}</dd></div>
              {selected.CardLabel && <div><dt>Card</dt><dd>{selected.CardLabel}</dd></div>}
            </dl>
            {selected.Id != null && (
              <label className="field">
                <span className="field-label">Category</span>
                <CategorySelect
                  tx={selected}
                  categories={categories}
                  saving={savingId === selected.Id}
                  onChange={changeCategory}
                  label="Category"
                />
              </label>
            )}
          </div>
        )}
      </Sheet>
    </div>
  );
}
