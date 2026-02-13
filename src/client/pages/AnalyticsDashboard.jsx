import React, { useState, useMemo, useEffect } from 'react';
import { Link } from 'react-router-dom';
import SpendingTrends from '../components/SpendingTrends';
import TopMerchants from '../components/TopMerchants';
import DebitCreditRatio from '../components/DebitCreditRatio';
import TransactionExplorer from '../components/TransactionExplorer';
import {
  filterAnalyticsData,
  filterByDateRange,
  searchByDescription,
} from '../utils/dataProcessing.js';
import './AnalyticsDashboard.css';

function AnalyticsDashboard({ csvData }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [dateStart, setDateStart] = useState('');
  const [dateEnd, setDateEnd] = useState('');
  const [granularity, setGranularity] = useState('monthly');

  const analyticsData = useMemo(() => filterAnalyticsData(csvData), [csvData]);

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
        <div className="analytics-empty-icon">📊</div>
        <h2>No Data Yet</h2>
        <p>Upload a credit card statement on the <Link to="/">Home page</Link> to see analytics.</p>
      </div>
    );
  }

  const handleClearFilters = () => {
    setSearchQuery('');
    setDateStart(defaultStart);
    setDateEnd(defaultEnd);
  };

  const hasFilters = searchQuery || dateStart !== defaultStart || dateEnd !== defaultEnd;

  return (
    <div className="analytics-dashboard">
      <div className="analytics-header">
        <h2>Analytics Dashboard</h2>
        <p className="analytics-subtitle">Deep dive into your spending patterns</p>
      </div>

      <div className="analytics-filters">
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
          <div className="analytics-charts-grid">
            <div className="chart-col-wide">
              <SpendingTrends data={filteredData} granularity={granularity} />
            </div>
            <div className="chart-col-narrow">
              <DebitCreditRatio data={filteredData} />
            </div>
          </div>

          <TopMerchants data={filteredData} />
          <TransactionExplorer data={filteredData} />
        </>
      )}
    </div>
  );
}

export default AnalyticsDashboard;
