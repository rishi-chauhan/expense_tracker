import React, { useMemo } from 'react';
import { Doughnut } from 'react-chartjs-2';
import '../utils/chartConfig.js';
import { getTooltipConfig, sharedAnimation } from '../utils/chartConfig.js';
import { useChartTheme } from '../hooks/useChartTheme';
import { groupByCategory, formatINR } from '../utils/dataProcessing.js';
import './CategoryBreakdown.css';

function CategoryBreakdown({ data }) {
  const chartColors = useChartTheme();
  const grouped = useMemo(() => groupByCategory(data), [data]);

  if (!grouped.length) {
    return (
      <div className="category-breakdown chart-section">
        <div className="chart-header">
          <div className="chart-title-group">
            <h3>Spending by Category</h3>
            <p className="chart-section-subtitle">No categorized spending in this range</p>
          </div>
        </div>
      </div>
    );
  }

  const chartData = {
    labels: grouped.map(g => g.name),
    datasets: [{
      data: grouped.map(g => g.total),
      backgroundColor: grouped.map(g => g.color || chartColors.accent),
      borderColor: chartColors.doughnutBorder,
      borderWidth: 2,
    }],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: true,
    aspectRatio: 1.4,
    plugins: {
      legend: {
        position: 'right',
        labels: {
          color: chartColors.tickColorPrimary,
          font: { family: chartColors.fontBody, size: 11 },
          boxWidth: 12,
        },
      },
      tooltip: {
        ...getTooltipConfig(chartColors),
        callbacks: {
          label: (ctx) => `${ctx.label}: ${formatINR(ctx.raw)}`,
        },
      },
    },
    animation: sharedAnimation,
  };

  return (
    <div className="category-breakdown chart-section">
      <div className="chart-header">
        <div className="chart-title-group">
          <h3>Spending by Category</h3>
          <p className="chart-section-subtitle">
            {grouped.length} categor{grouped.length === 1 ? 'y' : 'ies'}
          </p>
        </div>
      </div>
      <div className="chart-wrapper category-chart-wrap">
        <Doughnut data={chartData} options={options} />
      </div>
    </div>
  );
}

export default CategoryBreakdown;
