import React, { useState } from 'react';
import { Line } from 'react-chartjs-2';
import '../utils/chartConfig.js';
import {
  getTooltipConfig,
  getXScale,
  getYScale,
  sharedAnimation,
} from '../utils/chartConfig.js';
import { useChartTheme } from '../hooks/useChartTheme';
import { useSettings } from '../contexts/SettingsContext';
import { groupByMonth, groupByWeek } from '../utils/dataProcessing.js';
import './SpendingTrends.css';

function SpendingTrends({ data, granularity }) {
  const [activeDatasets, setActiveDatasets] = useState({ debits: true, credits: false });
  const chartColors = useChartTheme();
  const { showCredits } = useSettings();

  if (!data || data.length === 0) {
    return <p className="chart-empty">No data available for spending trends.</p>;
  }

  const toggleDataset = (key) => {
    setActiveDatasets(prev => {
      const next = { ...prev, [key]: !prev[key] };
      if (!next.debits && !next.credits) return prev;
      return next;
    });
  };

  const isWeekly = granularity === 'weekly';
  const { weeklyData, sortedWeeks } = isWeekly ? groupByWeek(data) : { weeklyData: {}, sortedWeeks: [] };
  const { monthlyData, sortedMonths } = !isWeekly ? groupByMonth(data) : { monthlyData: {}, sortedMonths: [] };

  const labels = isWeekly ? sortedWeeks : sortedMonths;
  const groupedData = isWeekly ? weeklyData : monthlyData;

  if (labels.length === 0) {
    return <p className="chart-empty">No data available for spending trends.</p>;
  }

  const allDatasets = [
    {
      key: 'debits',
      label: 'Debits',
      data: labels.map(key => groupedData[key].debits),
      borderColor: chartColors.debitSolid,
      backgroundColor: chartColors.debitFill,
      fill: true,
      tension: 0.3,
      pointRadius: 4,
      pointHoverRadius: 6,
      pointBackgroundColor: chartColors.debitSolid,
      pointBorderColor: chartColors.pointBorderColor,
      pointBorderWidth: 2,
    },
    ...(showCredits ? [{
      key: 'credits',
      label: 'Credits',
      data: labels.map(key => groupedData[key].credits),
      borderColor: chartColors.creditSolid,
      backgroundColor: chartColors.creditFill,
      fill: true,
      tension: 0.3,
      pointRadius: 4,
      pointHoverRadius: 6,
      pointBackgroundColor: chartColors.creditSolid,
      pointBorderColor: chartColors.pointBorderColor,
      pointBorderWidth: 2,
    }] : []),
  ];

  const xScale = getXScale(chartColors);

  const chartData = {
    labels,
    datasets: allDatasets.filter(ds => activeDatasets[ds.key]),
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: true,
    aspectRatio: 2.2,
    plugins: {
      legend: { display: false },
      title: { display: false },
      tooltip: {
        ...getTooltipConfig(chartColors),
        callbacks: {
          label: function(context) {
            return context.dataset.label + ': ₹' + context.parsed.y.toLocaleString('en-IN');
          }
        }
      }
    },
    scales: {
      x: {
        ...xScale,
        ticks: {
          ...xScale.ticks,
          maxRotation: 45,
          autoSkip: true,
          maxTicksLimit: 12,
        }
      },
      y: getYScale(chartColors),
    },
    animation: sharedAnimation,
  };

  return (
    <div className="spending-trends chart-section">
      <div className="chart-header">
        <div className="chart-title-group">
          <h3>Spending Trends</h3>
          <p className="chart-section-subtitle">
            {isWeekly ? 'Weekly' : 'Monthly'} spending over time
          </p>
        </div>
        <div className="chart-legend">
          <button
            type="button"
            className={`legend-item${activeDatasets.debits ? '' : ' inactive'}`}
            aria-pressed={activeDatasets.debits}
            onClick={() => toggleDataset('debits')}
          >
            <div className="legend-dot debits"></div>
            <span className="legend-label">Debits</span>
          </button>
          {showCredits && (
            <button
              type="button"
              className={`legend-item${activeDatasets.credits ? '' : ' inactive'}`}
              aria-pressed={activeDatasets.credits}
              onClick={() => toggleDataset('credits')}
            >
              <div className="legend-dot credits"></div>
              <span className="legend-label">Credits</span>
            </button>
          )}
        </div>
      </div>
      <div className="chart-wrapper">
        <Line data={chartData} options={chartOptions} />
      </div>
    </div>
  );
}

export default SpendingTrends;
