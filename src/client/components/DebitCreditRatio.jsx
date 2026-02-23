import React from 'react';
import { Doughnut } from 'react-chartjs-2';
import '../utils/chartConfig.js';
import { getTooltipConfig } from '../utils/chartConfig.js';
import { useChartTheme } from '../hooks/useChartTheme';
import { calculateSummaryStats, formatINR } from '../utils/dataProcessing.js';
import './DebitCreditRatio.css';

function DebitCreditRatio({ data }) {
  const chartColors = useChartTheme();

  if (!data || data.length === 0) {
    return <p className="chart-empty">No data available.</p>;
  }

  const { totalDebits, totalCredits } = calculateSummaryStats(data);

  if (totalDebits === 0 && totalCredits === 0) {
    return <p className="chart-empty">No transactions found.</p>;
  }

  const chartData = {
    labels: ['Debits (Expenses)', 'Credits (Payments)'],
    datasets: [{
      data: [totalDebits, totalCredits],
      backgroundColor: [chartColors.debit, chartColors.credit],
      borderColor: [chartColors.doughnutBorder, chartColors.doughnutBorder],
      borderWidth: 3,
      hoverOffset: 8,
    }]
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: true,
    aspectRatio: 1.4,
    cutout: '65%',
    plugins: {
      legend: { display: false },
      tooltip: {
        ...getTooltipConfig(chartColors),
        callbacks: {
          label: function(context) {
            const total = totalDebits + totalCredits;
            const pct = ((context.parsed / total) * 100).toFixed(1);
            return `${context.label}: ₹${context.parsed.toLocaleString('en-IN')} (${pct}%)`;
          }
        }
      }
    },
    animation: {
      duration: 750,
      easing: 'easeOutCubic',
    }
  };

  return (
    <div className="debit-credit-ratio chart-section">
      <div className="chart-header">
        <div className="chart-title-group">
          <h3>Debit / Credit Ratio</h3>
          <p className="chart-section-subtitle">Overall spending breakdown</p>
        </div>
      </div>
      <div className="doughnut-layout">
        <div className="doughnut-chart-wrapper">
          <Doughnut data={chartData} options={chartOptions} />
        </div>
        <div className="ratio-legend">
          <div className="ratio-legend-item">
            <div className="ratio-dot" style={{ background: chartColors.debitSolid }}></div>
            <div className="ratio-detail">
              <span className="ratio-label">Debits</span>
              <span className="ratio-value debit">{formatINR(totalDebits)}</span>
            </div>
          </div>
          <div className="ratio-legend-item">
            <div className="ratio-dot" style={{ background: chartColors.creditSolid }}></div>
            <div className="ratio-detail">
              <span className="ratio-label">Credits</span>
              <span className="ratio-value credit">{formatINR(totalCredits)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default DebitCreditRatio;
