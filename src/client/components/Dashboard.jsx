import React, { useState, useMemo } from 'react';
import { Line } from 'react-chartjs-2';
import '../utils/chartConfig.js';
import {
  sharedTooltipConfig,
  inrTooltipCallback,
  sharedXScale,
  sharedYScale,
  sharedAnimation,
  COLORS,
} from '../utils/chartConfig.js';
import {
  filterAnalyticsData,
  calculateSummaryStats,
  groupByMonth,
  formatINR,
} from '../utils/dataProcessing.js';
import './Dashboard.css';

const RANGES = [
  { label: '1M', months: 1 },
  { label: '3M', months: 3 },
  { label: '6M', months: 6 },
  { label: '12M', months: 12 },
  { label: 'All', months: null },
];

function Dashboard({ csvData }) {
  const [range, setRange] = useState('1M');

  const analyticsData = filterAnalyticsData(csvData);

  const filteredData = useMemo(() => {
    if (analyticsData.length === 0) return analyticsData;

    const selected = RANGES.find(r => r.label === range);
    if (!selected || selected.months === null) return analyticsData;

    const latestDate = analyticsData.reduce((max, t) => {
      const d = new Date(t.Date);
      return d > max ? d : max;
    }, new Date(0));

    const cutoff = new Date(latestDate);
    cutoff.setMonth(cutoff.getMonth() - selected.months);

    return analyticsData.filter(t => new Date(t.Date) >= cutoff);
  }, [analyticsData, range]);

  if (!csvData || csvData.length === 0) {
    return <p className="dashboard-message">Upload a CSV file to see your dashboard.</p>;
  }

  const { totalDebits, totalCredits, netSpending } = calculateSummaryStats(filteredData);
  const { monthlyData, sortedMonths } = groupByMonth(filteredData);

  const lineChartData = {
    labels: sortedMonths,
    datasets: [
      {
        label: 'Total Spending',
        data: sortedMonths.map(month => monthlyData[month].debits),
        borderColor: COLORS.debitSolid,
        backgroundColor: 'rgba(240, 99, 122, 0.08)',
        borderWidth: 2,
        fill: true,
        tension: 0.3,
        pointBackgroundColor: COLORS.debitSolid,
        pointBorderColor: COLORS.debitSolid,
        pointRadius: 4,
        pointHoverRadius: 6,
      },
    ]
  };

  const lineChartOptions = {
    responsive: true,
    maintainAspectRatio: true,
    aspectRatio: 2,
    plugins: {
      legend: { display: false },
      title: { display: false },
      tooltip: {
        ...sharedTooltipConfig,
        callbacks: inrTooltipCallback,
      }
    },
    scales: {
      x: sharedXScale,
      y: sharedYScale,
    },
    animation: sharedAnimation,
  };

  return (
    <div className="dashboard-container">
      <h2>Credit Card Statement Analysis</h2>

      <div className="summary-stats">
        <div className="stat-card debits">
          <div className="stat-card-header">
            <div className="stat-icon">↓</div>
            <div className="stat-label">Total Debits</div>
          </div>
          <div className="stat-value">{formatINR(totalDebits)}</div>
          <div className="stat-trend">Expenses</div>
        </div>

        <div className="stat-card credits">
          <div className="stat-card-header">
            <div className="stat-icon">↑</div>
            <div className="stat-label">Total Credits</div>
          </div>
          <div className="stat-value">{formatINR(totalCredits)}</div>
          <div className="stat-trend">Payments</div>
        </div>

        <div className="stat-card net">
          <div className="stat-card-header">
            <div className="stat-icon">Σ</div>
            <div className="stat-label">Net Spending</div>
          </div>
          <div className="stat-value">{formatINR(netSpending)}</div>
          <div className="stat-trend">Balance</div>
        </div>
      </div>

      <div className="chart-section">
        <div className="chart-header">
          <div className="chart-title-group">
            <h3>Monthly Spending</h3>
            <p className="chart-section-subtitle">
              Total spending over time
            </p>
          </div>
          <div className="chart-controls">
            <div className="chart-legend">
              <div className="legend-item">
                <div className="legend-dot debits"></div>
                <span className="legend-label">Spending</span>
              </div>
            </div>
            <div className="range-selector">
              {RANGES.map(r => (
                <button
                  key={r.label}
                  className={`range-btn${range === r.label ? ' active' : ''}`}
                  onClick={() => setRange(r.label)}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {sortedMonths.length > 0 ? (
          <>
            <div className="chart-wrapper">
              <Line data={lineChartData} options={lineChartOptions} />
            </div>
            <div className="chart-footer">
              <span>{filteredData.length} transactions</span>
              <span className="chart-footer-divider">•</span>
              <span>{sortedMonths.length} months</span>
            </div>
          </>
        ) : (
          <p className="dashboard-message">No valid date or amount data found for monthly spending chart.</p>
        )}
      </div>
    </div>
  );
}

export default Dashboard;
