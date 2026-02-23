import React from 'react';
import { Bar } from 'react-chartjs-2';
import '../utils/chartConfig.js';
import {
  getTooltipConfig,
  sharedAnimation,
} from '../utils/chartConfig.js';
import { useChartTheme } from '../hooks/useChartTheme';
import { groupByDescription } from '../utils/dataProcessing.js';
import './TopMerchants.css';

function TopMerchants({ data }) {
  const chartColors = useChartTheme();

  if (!data || data.length === 0) {
    return <p className="chart-empty">No data available for top merchants.</p>;
  }

  const merchants = groupByDescription(data).slice(0, 10);

  if (merchants.length === 0) {
    return <p className="chart-empty">No debit transactions found.</p>;
  }

  // Truncate long labels
  const labels = merchants.map(m =>
    m.description.length > 30 ? m.description.slice(0, 27) + '...' : m.description
  );

  const chartData = {
    labels,
    datasets: [{
      label: 'Total Spent',
      data: merchants.map(m => m.total),
      backgroundColor: chartColors.debit,
      borderWidth: 0,
      borderRadius: 4,
      borderSkipped: false,
    }]
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: true,
    aspectRatio: 1.4,
    indexAxis: 'y',
    plugins: {
      legend: { display: false },
      title: { display: false },
      tooltip: {
        ...getTooltipConfig(chartColors),
        callbacks: {
          label: function(context) {
            const merchant = merchants[context.dataIndex];
            return [
              `Total: ₹${context.parsed.x.toLocaleString('en-IN')}`,
              `${merchant.count} transaction${merchant.count !== 1 ? 's' : ''}`
            ];
          }
        }
      }
    },
    scales: {
      x: {
        grid: { color: chartColors.gridColor },
        border: { color: chartColors.borderColor },
        ticks: {
          font: {
            family: chartColors.fontMono,
            size: 11,
          },
          color: chartColors.tickColorSecondary,
          callback: function(value) {
            return '₹' + value.toLocaleString('en-IN');
          }
        }
      },
      y: {
        grid: { display: false },
        border: { color: chartColors.borderColor },
        ticks: {
          font: {
            family: chartColors.fontBody,
            size: 11,
          },
          color: chartColors.tickColorPrimary,
        }
      }
    },
    animation: sharedAnimation,
  };

  return (
    <div className="top-merchants chart-section">
      <div className="chart-header">
        <div className="chart-title-group">
          <h3>Top Merchants</h3>
          <p className="chart-section-subtitle">Highest spending by merchant</p>
        </div>
      </div>
      <div className="chart-wrapper">
        <Bar data={chartData} options={chartOptions} />
      </div>
    </div>
  );
}

export default TopMerchants;
