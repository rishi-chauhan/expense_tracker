import React, { memo, useMemo, useState } from 'react';
import { Line } from 'react-chartjs-2';
import '../utils/chartConfig.js';
import {
  getTooltipConfig,
  getXScale,
  getYScale,
  sharedAnimation,
  chartDevicePixelRatio,
} from '../utils/chartConfig.js';
import { useChartTheme } from '../hooks/useChartTheme';
import { useSettings } from '../contexts/SettingsContext';
import { groupByMonth, groupByWeek } from '../utils/dataProcessing.js';
import './SpendingTrends.css';

function SpendingTrends({ data, granularity }) {
  const [activeDatasets, setActiveDatasets] = useState({ debits: true, credits: false });
  const chartColors = useChartTheme();
  const { showCredits } = useSettings();

  const isWeekly = granularity === 'weekly';

  // Aggregate once per data/granularity change, not on every render.
  const { labels, groupedData } = useMemo(() => {
    if (!data || data.length === 0) return { labels: [], groupedData: {} };
    if (isWeekly) {
      const { weeklyData, sortedWeeks } = groupByWeek(data);
      return { labels: sortedWeeks, groupedData: weeklyData };
    }
    const { monthlyData, sortedMonths } = groupByMonth(data);
    return { labels: sortedMonths, groupedData: monthlyData };
  }, [data, isWeekly]);

  const chartData = useMemo(() => {
    const dense = labels.length > 30;
    const pointStyle = (color) => ({
      pointRadius: dense ? 0 : 4,
      pointHoverRadius: dense ? 4 : 6,
      pointBackgroundColor: color,
      pointBorderColor: chartColors.pointBorderColor,
      pointBorderWidth: 2,
    });
    const datasets = [
      {
        key: 'debits',
        label: 'Debits',
        data: labels.map(key => groupedData[key].debits),
        borderColor: chartColors.debitSolid,
        backgroundColor: chartColors.debitFill,
        fill: true,
        tension: 0.3,
        ...pointStyle(chartColors.debitSolid),
      },
      ...(showCredits ? [{
        key: 'credits',
        label: 'Credits',
        data: labels.map(key => groupedData[key].credits),
        borderColor: chartColors.creditSolid,
        backgroundColor: chartColors.creditFill,
        fill: true,
        tension: 0.3,
        ...pointStyle(chartColors.creditSolid),
      }] : []),
    ];
    return { labels, datasets: datasets.filter(ds => activeDatasets[ds.key]) };
  }, [labels, groupedData, chartColors, showCredits, activeDatasets]);

  const chartOptions = useMemo(() => {
    const xScale = getXScale(chartColors);
    return {
      responsive: true,
      maintainAspectRatio: true,
      aspectRatio: 2.2,
      devicePixelRatio: chartDevicePixelRatio,
      plugins: {
        legend: { display: false },
        title: { display: false },
        tooltip: {
          ...getTooltipConfig(chartColors),
          callbacks: {
            label: (context) => context.dataset.label + ': ₹' + context.parsed.y.toLocaleString('en-IN'),
          },
        },
      },
      scales: {
        x: {
          ...xScale,
          ticks: { ...xScale.ticks, maxRotation: 45, autoSkip: true, maxTicksLimit: 12 },
        },
        y: getYScale(chartColors),
      },
      animation: sharedAnimation,
    };
  }, [chartColors]);

  if (labels.length === 0) {
    return <p className="chart-empty">No data available for spending trends.</p>;
  }

  const toggleDataset = (key) => {
    setActiveDatasets(prev => {
      const next = { ...prev, [key]: !prev[key] };
      if (!next.debits && !next.credits) return prev;
      return next;
    });
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

export default memo(SpendingTrends);
