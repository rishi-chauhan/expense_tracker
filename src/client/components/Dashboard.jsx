import React, { useState, useMemo } from 'react';
import { Line } from 'react-chartjs-2';
import '../utils/chartConfig.js';
import {
  getTooltipConfig,
  inrTooltipCallback,
  getXScale,
  getYScale,
  sharedAnimation,
} from '../utils/chartConfig.js';
import { useChartTheme } from '../hooks/useChartTheme';
import { useSettings } from '../contexts/SettingsContext';
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
  const chartColors = useChartTheme();
  const { showCredits } = useSettings();

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
    return (
      <div className="dashboard-message glass">
        <p>Upload a CSV file to see your dashboard.</p>
      </div>
    );
  }

  const { totalDebits, totalCredits, netSpending } = calculateSummaryStats(filteredData);
  const { monthlyData, sortedMonths } = groupByMonth(filteredData);

  const lineChartData = {
    labels: sortedMonths,
    datasets: [
      {
        label: 'Total Spending',
        data: sortedMonths.map(month => monthlyData[month].debits),
        borderColor: chartColors.debitSolid,
        backgroundColor: chartColors.debitFill,
        borderWidth: 2,
        fill: true,
        tension: 0.3,
        pointBackgroundColor: chartColors.debitSolid,
        pointBorderColor: chartColors.debitSolid,
        pointRadius: 4,
        pointHoverRadius: 6,
      },
    ]
  };

  const lineChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      title: { display: false },
      tooltip: {
        ...getTooltipConfig(chartColors),
        callbacks: inrTooltipCallback,
      }
    },
    scales: {
      x: getXScale(chartColors),
      y: getYScale(chartColors),
    },
    animation: sharedAnimation,
  };

  return (
    <div className="dashboard-container">
      <h2>Statement Analysis</h2>

      <div className="summary-stats">
        <div className="stat-card debits">
          <div className="stat-card-header">
            <div className="stat-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 5v14M5 12l7 7 7-7"/>
              </svg>
            </div>
            <div className="stat-label">Total Debits</div>
          </div>
          <div className="stat-value">{formatINR(totalDebits)}</div>
          <div className="stat-trend">Expenses</div>
        </div>

        {showCredits && (
          <div className="stat-card credits">
            <div className="stat-card-header">
              <div className="stat-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 19V5M5 12l7-7 7 7"/>
                </svg>
              </div>
              <div className="stat-label">Total Credits</div>
            </div>
            <div className="stat-value">{formatINR(totalCredits)}</div>
            <div className="stat-trend">Payments</div>
          </div>
        )}

        {showCredits && (
          <div className="stat-card net">
            <div className="stat-card-header">
              <div className="stat-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M7 7h10M7 12h10M7 17h10"/>
                </svg>
              </div>
              <div className="stat-label">Net Spending</div>
            </div>
            <div className="stat-value">{formatINR(netSpending)}</div>
            <div className="stat-trend">Balance</div>
          </div>
        )}
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
          <p className="dashboard-message">No valid data for monthly spending chart.</p>
        )}
      </div>
    </div>
  );
}

export default Dashboard;
