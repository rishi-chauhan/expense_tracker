import React, { useState, useMemo, useEffect } from 'react';
import { Link } from 'react-router-dom';
import SpendingTrends from '../components/SpendingTrends';
import TopMerchants from '../components/TopMerchants';
import DebitCreditRatio from '../components/DebitCreditRatio';
import TransactionExplorer from '../components/TransactionExplorer';
import CategoryBreakdown from '../components/CategoryBreakdown';
import { useSettings } from '../contexts/SettingsContext';
import { exportTransactions } from '../utils/api.js';
import {
  filterAnalyticsData,
  filterByDateRange,
  searchByDescription,
  filterByCard,
} from '../utils/dataProcessing.js';
import './AnalyticsDashboard.css';

function AnalyticsDashboard({ csvData, cards, onCategoryChange }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [dateStart, setDateStart] = useState('');
  const [dateEnd, setDateEnd] = useState('');
  const [granularity, setGranularity] = useState('monthly');
  const [selectedCardId, setSelectedCardId] = useState('all');
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState('');
  const { showCredits } = useSettings();

  const cardFilteredData = useMemo(() => filterByCard(csvData, selectedCardId), [csvData, selectedCardId]);
  const analyticsData = useMemo(() => filterAnalyticsData(cardFilteredData), [cardFilteredData]);

  const { defaultStart, defaultEnd } = useMemo(() => {
    if (analyticsData.length === 0) return { defaultStart: '', defaultEnd: '' };
    const latest = analyticsData.reduce((max, t) => {
      const d = new Date(t.Date);
      return d > max ? d : max;
    }, new Date(0));
    const start = new Date(latest);
    start.setMonth(start.getMonth() - 1);
    const fmt = d => d.toISOString().split('T')[0];
    return { defaultStart: fmt(start), defaultEnd: fmt(latest) };
  }, [analyticsData]);

  useEffect(() => {
    if (defaultStart && !dateStart && !dateEnd) {
      setDateStart(defaultStart);
      setDateEnd(defaultEnd);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultStart, defaultEnd]);

  const filteredData = useMemo(() => {
    let result = analyticsData;
    result = filterByDateRange(result, dateStart, dateEnd);
    result = searchByDescription(result, searchQuery);
    return result;
  }, [analyticsData, dateStart, dateEnd, searchQuery]);

  if (!csvData || csvData.length === 0) {
    return (
      <div className="analytics-empty">
        <div className="analytics-empty-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24"><path d="M4 20V10m6 10V4m6 16v-7m4 7H2" /></svg>
        </div>
        <h2>No Data Yet</h2>
        <p>Upload a credit card statement on the <Link to="/">Home page</Link> to see analytics.</p>
      </div>
    );
  }

  const handleClearFilters = () => {
    setSearchQuery('');
    setDateStart(defaultStart);
    setDateEnd(defaultEnd);
    setSelectedCardId('all');
  };

  const handleExport = async () => {
    setExporting(true);
    setExportError('');
    try {
      await exportTransactions({
        cardId: selectedCardId !== 'all' ? selectedCardId : undefined,
        startDate: dateStart || undefined,
        endDate: dateEnd || undefined,
      });
    } catch (err) {
      console.error('Export failed:', err);
      setExportError(err.message || 'Export failed');
    } finally {
      setExporting(false);
    }
  };

  const hasFilters = searchQuery || dateStart !== defaultStart || dateEnd !== defaultEnd || selectedCardId !== 'all';

  return (
    <div className="analytics-dashboard">
      <div className="analytics-header">
        <div>
          <span className="eyebrow">Explore</span>
          <h2>Analytics Dashboard</h2>
          <p className="analytics-subtitle">Deep dive into your spending patterns</p>
        </div>
        <div className="analytics-result-count">
          <strong>{filteredData.length}</strong>
          <span>transactions in view</span>
        </div>
      </div>

      {exportError && <div className="analytics-alert" role="alert">{exportError}</div>}

      <div className="analytics-filters">
        {cards && cards.length > 1 && (
          <div className="filter-group">
            <label className="filter-label" htmlFor="card-filter">Card</label>
            <select
              id="card-filter"
              className="filter-input"
              value={selectedCardId}
              onChange={e => setSelectedCardId(e.target.value)}
            >
              <option value="all">All Cards</option>
              {cards.map(card => (
                <option key={card.id} value={card.id}>{card.card_label}</option>
              ))}
            </select>
          </div>
        )}
        <div className="filter-group">
          <label className="filter-label" htmlFor="search-input">Search</label>
          <input
            id="search-input"
            type="text"
            className="filter-input"
            placeholder="Search transactions..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="filter-group">
          <label className="filter-label" htmlFor="date-start">From</label>
          <input
            id="date-start"
            type="date"
            className="filter-input"
            value={dateStart}
            max={dateEnd || undefined}
            onChange={e => setDateStart(e.target.value)}
          />
        </div>
        <div className="filter-group">
          <label className="filter-label" htmlFor="date-end">To</label>
          <input
            id="date-end"
            type="date"
            className="filter-input"
            value={dateEnd}
            min={dateStart || undefined}
            onChange={e => setDateEnd(e.target.value)}
          />
        </div>
        <div className="filter-group">
          <label className="filter-label">Granularity</label>
          <div className="granularity-toggle" role="group" aria-label="Chart granularity">
            <button
              type="button"
              className={`toggle-btn ${granularity === 'weekly' ? 'active' : ''}`}
              aria-pressed={granularity === 'weekly'}
              onClick={() => setGranularity('weekly')}
            >
              Weekly
            </button>
            <button
              type="button"
              className={`toggle-btn ${granularity === 'monthly' ? 'active' : ''}`}
              aria-pressed={granularity === 'monthly'}
              onClick={() => setGranularity('monthly')}
            >
              Monthly
            </button>
          </div>
        </div>
        <button
          type="button"
          className="clear-filters-btn export-btn"
          onClick={handleExport}
          disabled={exporting}
        >
          {exporting ? 'Exporting…' : 'Export CSV'}
        </button>
        {hasFilters && (
          <button className="clear-filters-btn" onClick={handleClearFilters}>
            Clear filters
          </button>
        )}
      </div>

      {filteredData.length === 0 ? (
        <div className="analytics-no-results">
          <p>No transactions match your filters.</p>
          <button className="clear-filters-btn" onClick={handleClearFilters}>
            Clear filters
          </button>
        </div>
      ) : (
        <>
          <div className={`analytics-charts-grid${showCredits ? '' : ' full-width'}`}>
            <div className={showCredits ? 'chart-col-wide' : 'chart-col-full'}>
              <SpendingTrends data={filteredData} granularity={granularity} />
            </div>
            {showCredits && (
              <div className="chart-col-narrow">
                <DebitCreditRatio data={filteredData} />
              </div>
            )}
          </div>

          <CategoryBreakdown data={filteredData} />
          <TopMerchants data={filteredData} />
          <TransactionExplorer data={filteredData} onCategoryChange={onCategoryChange} />
        </>
      )}
    </div>
  );
}

export default AnalyticsDashboard;
