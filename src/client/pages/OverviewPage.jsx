import React, { lazy, Suspense, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useFilters } from '../contexts/FilterContext';
import { useSettings } from '../contexts/SettingsContext';
import { useApiData } from '../hooks/useApiData';
import { getBudgets, getRecurring } from '../utils/api.js';
import {
  calculateSummaryStats,
  groupByCategory,
  groupByDescription,
  parseDateKey,
} from '../utils/dataProcessing.js';
import MoneyStrip from '../components/MoneyStrip';
import FileUpload from '../components/FileUpload';
import TransactionRow from '../components/TransactionRow';
import { formatDay as formatTxDate } from '../utils/dataProcessing.js';
import { Card, CardHeader } from '../components/ui/Card';
import StatTile from '../components/ui/StatTile';
import Amount from '../components/ui/Amount';
import Skeleton from '../components/ui/Skeleton';
import EmptyState from '../components/ui/EmptyState';
import Icon from '../components/ui/Icon';
import '../components/ChartCard.css';
import './OverviewPage.css';

// Chart.js stays out of the initial bundle: the chart sits below the fold.
const SpendingBarChart = lazy(() => import('../components/SpendingBarChart'));

const DAY_MS = 86_400_000;
const UNCATEGORISED = '#8b90a0';

function daysInRange(range, firstDate, latestDate) {
  const from = range.from || firstDate;
  const to = range.to || latestDate;
  if (!from || !to) return 0;
  return Math.max(1, Math.round((parseDateKey(to) - parseDateKey(from)) / DAY_MS) + 1);
}

function PercentChange({ current, previous }) {
  if (!previous) return <span className="stat-note">No earlier data</span>;
  const pct = ((current - previous) / previous) * 100;
  const up = pct > 0;
  const tone = Math.abs(pct) < 0.5 ? null : up ? 'debit' : 'credit';
  return (
    <span className={`stat-note${tone ? ` is-${tone}` : ''}`}>
      {tone && <Icon name={up ? 'arrowUp' : 'arrowDown'} size={14} />}
      {Math.abs(pct).toFixed(Math.abs(pct) < 10 ? 1 : 0)}% {up ? 'more' : 'less'} than the period before
    </span>
  );
}

export function OverviewSkeleton() {
  return (
    <div className="page overview" aria-busy="true" aria-label="Loading overview">
      <div className="overview-hero-skeleton">
        <Skeleton width="60%" height={48} />
        <Skeleton height={20} radius={999} />
      </div>
      <div className="kpi-row">
        {[0, 1, 2].map(i => <Skeleton key={i} height={56} />)}
      </div>
      <Card><Skeleton height={240} /></Card>
    </div>
  );
}

function ProgressRow({ color, name, value, pct, to, warn }) {
  const content = (
    <>
      <span className="pr-head">
        <span className="pr-name">
          <span className="pr-dot" style={{ background: color || UNCATEGORISED }} aria-hidden="true" />
          {name}
        </span>
        <span className="pr-value">{value}</span>
      </span>
      <span className="pr-bar" aria-hidden="true">
        <span className={`pr-fill${warn ? ` is-${warn}` : ''}`} style={{ width: `${Math.min(100, pct)}%`, background: warn ? undefined : color || UNCATEGORISED }} />
      </span>
    </>
  );
  return <li className="pr-row">{to ? <Link to={to} className="pr-link">{content}</Link> : <div className="pr-link">{content}</div>}</li>;
}

export default function OverviewPage({ csvData, loading, dataKey, onFileUpload, onUploadError }) {
  const { showCredits } = useSettings();
  const {
    filtered, previousFiltered, previousRange, range, rangeLabel,
    firstDate, latestDate, filterSearch,
  } = useFilters();

  const budgets = useApiData(getBudgets, dataKey);
  const recurring = useApiData(getRecurring, dataKey);

  const stats = useMemo(() => calculateSummaryStats(filtered), [filtered]);
  const prevStats = useMemo(() => calculateSummaryStats(previousFiltered), [previousFiltered]);
  const categories = useMemo(() => groupByCategory(filtered), [filtered]);
  const merchants = useMemo(() => groupByDescription(filtered).slice(0, 5), [filtered]);
  const recent = useMemo(
    () => [...filtered]
      .filter(t => showCredits || !t.IsCredit)
      .sort((a, b) => (b.Ts ?? 0) - (a.Ts ?? 0) || (b.Id ?? 0) - (a.Id ?? 0))
      .slice(0, 8),
    [filtered, showCredits]
  );
  const debitCount = useMemo(() => filtered.filter(t => !t.IsCredit).length, [filtered]);
  const days = daysInRange(range, firstDate, latestDate);
  const weekly = days > 0 && days <= 93;

  const categoryLink = useCallback((cat) => {
    const params = new URLSearchParams(filterSearch.slice(1));
    params.set('category', cat.categoryId == null ? 'none' : String(cat.categoryId));
    return `/transactions?${params.toString()}`;
  }, [filterSearch]);

  if (!csvData || csvData.length === 0) {
    if (loading) return <OverviewSkeleton />;
    return (
      <div className="page overview">
        <Card className="welcome-card">
          <h2 className="welcome-title">Upload your first statement</h2>
          <p className="welcome-text">
            Export a credit card statement as CSV from your bank and drop it here. You will see where your money went in seconds.
          </p>
          <FileUpload onFileUpload={onFileUpload} onError={onUploadError} />
          <p className="welcome-privacy">
            <Icon name="eyeOff" size={16} />
            Stays on your Pi. Nothing leaves your network.
          </p>
        </Card>
      </div>
    );
  }

  const total = stats.totalDebits;
  const categoryTotal = categories.reduce((s, c) => s + c.total, 0) || 1;

  return (
    <div className="page overview">
      <MoneyStrip total={total} rangeLabel={rangeLabel} categories={categories} linkFor={categoryLink} />

      <div className={`kpi-row${showCredits ? ' has-credits' : ''}`}>
        <StatTile
          label="Compared with before"
          value={previousRange ? <Amount value={prevStats.totalDebits} whole /> : '—'}
          note={previousRange ? <PercentChange current={total} previous={prevStats.totalDebits} /> : 'Pick a shorter period to compare'}
        />
        <StatTile label="Average per day" value={<Amount value={days ? total / days : 0} whole />} note={`Over ${days} day${days === 1 ? '' : 's'}`} />
        <StatTile label="Transactions" value={debitCount.toLocaleString('en-IN')} note={debitCount ? <>Average <Amount value={total / debitCount} whole /></> : null} />
        {showCredits && (
          <>
            <StatTile label="Credits" value={<Amount value={stats.totalCredits} whole tone="credit" />} />
            <StatTile label="Net" value={<Amount value={stats.netSpending} whole />} note="Spent minus credits" />
          </>
        )}
      </div>

      {filtered.length === 0 ? (
        <Card>
          <EmptyState icon="calendar" title="Nothing in this period">
            No transactions between these dates. Try a longer period or All.
          </EmptyState>
        </Card>
      ) : (
        <>
          <Card className="chart-card">
            <CardHeader title="Spending over time" subtitle={weekly ? 'By week' : 'By month'} />
            <p className="sr-only">Total spent {rangeLabel}. See the transactions page for exact figures.</p>
            <div className="chart-box chart-box-md">
              <Suspense fallback={<Skeleton height="100%" />}>
                <SpendingBarChart data={filtered} weekly={weekly} />
              </Suspense>
            </div>
          </Card>

          <div className="grid-2">
            <Card>
              <CardHeader title="Where it went" subtitle="Tap a category to see its transactions" />
              {categories.length === 0 ? (
                <EmptyState icon="categories" title="No spending yet">Only credits in this period.</EmptyState>
              ) : (
                <ul className="pr-list">
                  {categories.slice(0, 8).map(c => (
                    <ProgressRow
                      key={c.name}
                      color={c.color}
                      name={c.name}
                      to={categoryLink(c)}
                      pct={(c.total / categoryTotal) * 100}
                      value={<><Amount value={c.total} whole /> <span className="pr-pct num">{Math.round((c.total / categoryTotal) * 100)}%</span></>}
                    />
                  ))}
                </ul>
              )}
            </Card>

            <Card>
              <CardHeader
                title="Budgets"
                subtitle={budgets.data?.yearMonth ? `This month, ${formatTxDate(`${budgets.data.yearMonth}-01`, true).replace(/^1 /, '')}` : 'This month'}
                actions={<Link to="/categories" className="card-link">Edit</Link>}
              />
              {budgets.loading ? (
                <div className="stack-skeleton">{[0, 1, 2].map(i => <Skeleton key={i} height={32} />)}</div>
              ) : budgets.error ? (
                <p className="muted">Couldn't load budgets.</p>
              ) : !budgets.data?.budgets?.length ? (
                <EmptyState icon="categories" title="No budgets yet" action={<Link to="/categories">Set a monthly budget</Link>}>
                  Give a category a monthly limit and track it here.
                </EmptyState>
              ) : (
                <ul className="pr-list">
                  {budgets.data.budgets.map(b => {
                    const pct = b.amount > 0 ? (b.spent / b.amount) * 100 : 0;
                    return (
                      <ProgressRow
                        key={b.id}
                        color={b.category_color}
                        name={b.category_name}
                        pct={pct}
                        warn={pct >= 100 ? 'danger' : pct >= 80 ? 'warning' : null}
                        value={<><Amount value={b.spent} whole /> <span className="pr-of">of <Amount value={b.amount} whole /></span></>}
                      />
                    );
                  })}
                </ul>
              )}
            </Card>
          </div>

          <div className="grid-2">
            <Card>
              <CardHeader title="Top merchants" subtitle="Biggest spends this period" />
              {merchants.length === 0 ? (
                <p className="muted">No debit transactions.</p>
              ) : (
                <ol className="rank-list">
                  {merchants.map(m => (
                    <li key={m.description} className="rank-row">
                      <span className="rank-name">{m.description}</span>
                      <span className="rank-count">{m.count}×</span>
                      <Amount value={m.total} whole className="rank-amount" />
                    </li>
                  ))}
                </ol>
              )}
            </Card>

            <Card>
              <CardHeader title="Recurring" subtitle="Similar amounts in 3+ months" />
              {recurring.loading ? (
                <div className="stack-skeleton">{[0, 1, 2].map(i => <Skeleton key={i} height={32} />)}</div>
              ) : !recurring.data?.recurring?.length ? (
                <p className="muted">No recurring payments detected yet.</p>
              ) : (
                <ul className="rank-list">
                  {recurring.data.recurring.slice(0, 5).map(r => (
                    <li key={r.description} className="rank-row">
                      <span className="rank-name">{r.description}</span>
                      <span className="rank-count">Last {formatTxDate(r.lastDate)}</span>
                      <Amount value={r.avgAmount} whole className="rank-amount" />
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>

          <Card>
            <CardHeader
              title="Recent transactions"
              actions={<Link to={`/transactions${filterSearch}`} className="card-link">View all</Link>}
            />
            <ul className="tx-list">
              {recent.map(tx => <TransactionRow key={tx.Id ?? `${tx.DateStr}-${tx.Description}`} tx={tx} />)}
            </ul>
          </Card>
        </>
      )}
    </div>
  );
}
