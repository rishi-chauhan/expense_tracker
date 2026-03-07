import React, { useState, useMemo, useEffect } from 'react';
import { Link } from 'react-router-dom';
import SpendingTrends from '../components/SpendingTrends';
import TopMerchants from '../components/TopMerchants';
import DebitCreditRatio from '../components/DebitCreditRatio';
import TransactionExplorer from '../components/TransactionExplorer';
import { useSettings } from '../contexts/SettingsContext';
import {
  filterAnalyticsData,
  filterByDateRange,
  searchByDescription,
  filterByCard,
} from '../utils/dataProcessing.js';
import './AnalyticsDashboard.css';

function AnalyticsDashboard({ csvData, cards }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [dateStart, setDateStart] = useState('');
  const [dateEnd, setDateEnd] = useState('');
  const [granularity, setGranularity] = useState('monthly');
  const [selectedCardId, setSelectedCardId] = useState('all');
  const { showCredits } = useSettings();

  const cardFilteredData = useMemo(() => filterByCard(csvData, selectedCardId), [csvData, selectedCardId]);
  const analyticsData = useMemo(() => filterAnalyticsData(cardFilteredData), [cardFilteredData]);

  // Compute 1-month default window from latest transaction
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

  // Apply 1-month default on first load
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
      <div className="analytics-empty glass">
        <div className="analytics-empty-icon">
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="20" x2="18" y2="10"/>
            <line x1="12" y1="20" x2="12" y2="4"/>
            <line x1="6" y1="20" x2="6" y2="14"/>
          </svg>
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

  const hasFilters = searchQuery || dateStart !== defaultStart || dateEnd !== defaultEnd || selectedCardId !== 'all';

  return (
    <div className="analytics-dashboard">
      <div className="analytics-header">
        <h2>Analytics Dashboard</h2>
        <p className="analytics-subtitle">Deep dive into your spending patterns</p>
      </div>

      <div className="analytics-filters glass">
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
        <div className="filter-group search-group">
          <label className="filter-label" htmlFor="search-input">Search</label>
          <div className="search-wrapper">
            <svg className="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              id="search-input"
              type="text"
              className="filter-input has-icon"
              placeholder="Search transactions..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
        <div className="filter-group">
          <label className="filter-label" htmlFor="date-start">From</label>
          <input
            id="date-start"
            type="date"
            className="filter-input"
            value={dateStart}
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
            onChange={e => setDateEnd(e.target.value)}
          />
        </div>
        <div className="filter-group">
          <label className="filter-label">Granularity</label>
          <div className="granularity-toggle">
            <button
              className={`toggle-btn ${granularity === 'weekly' ? 'active' : ''}`}
              onClick={() => setGranularity('weekly')}
            >
              Weekly
            </button>
            <button
              className={`toggle-btn ${granularity === 'monthly' ? 'active' : ''}`}
              onClick={() => setGranularity('monthly')}
            >
              Monthly
            </button>
          </div>
        </div>
        {hasFilters && (
          <button className="clear-filters-btn" onClick={handleClearFilters}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: '6px'}}>
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
            Clear
          </button>
        )}
      </div>

      {filteredData.length === 0 ? (
        <div className="analytics-no-results glass">
          <p>No transactions match your filters.</p>
          <button className="clear-filters-btn" onClick={handleClearFilters}>
            Reset Filters
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

          <TopMerchants data={filteredData} />
          <TransactionExplorer data={filteredData} />
        </>
      )}
    </div>
  );
}

export default AnalyticsDashboard;
