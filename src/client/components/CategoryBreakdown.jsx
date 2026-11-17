import React, { memo, useMemo } from 'react';
import { Doughnut } from 'react-chartjs-2';
import { getTooltipConfig, sharedAnimation, chartDevicePixelRatio, money } from '../utils/chartConfig.js';
import { useChartTheme } from '../hooks/useChartTheme';
import { groupByCategory } from '../utils/dataProcessing.js';
import ChartCard from './ChartCard';
import Amount from './ui/Amount';
import './CategoryBreakdown.css';

const UNCATEGORISED = '#8b90a0';

/** Category split doughnut with the period total in the centre. */
function CategoryBreakdown({ data }) {
  const chartColors = useChartTheme();
  const grouped = useMemo(() => groupByCategory(data), [data]);
  const total = useMemo(() => grouped.reduce((s, g) => s + g.total, 0), [grouped]);

  const { chartData, options } = useMemo(() => ({
    chartData: {
      labels: grouped.map(g => g.name),
      datasets: [{
        data: grouped.map(g => g.total),
        backgroundColor: grouped.map(g => g.color || UNCATEGORISED),
        borderColor: chartColors.doughnutBorder,
        borderWidth: 2,
        hoverOffset: 4,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      devicePixelRatio: chartDevicePixelRatio,
      cutout: '72%',
      plugins: {
        legend: { display: false },
        tooltip: {
          ...getTooltipConfig(chartColors),
          callbacks: {
            label: (ctx) => `${ctx.label}: ${money(chartColors, ctx.raw)} (${Math.round((ctx.raw / total) * 100)}%)`,
          },
        },
      },
      animation: sharedAnimation,
    },
  }), [grouped, total, chartColors]);

  if (!grouped.length) {
    return (
      <ChartCard className="category-breakdown" title="Category split" subtitle="No categorised spending in this period" height="sm">
        <p className="chart-empty">Add rules on the Categories page to tag merchants automatically.</p>
      </ChartCard>
    );
  }

  return (
    <ChartCard
      className="category-breakdown"
      title="Category split"
      subtitle={`${grouped.length} categor${grouped.length === 1 ? 'y' : 'ies'}`}
      summary={`Largest category: ${grouped[0].name}, ${Math.round((grouped[0].total / total) * 100)}% of spending.`}
      height="lg"
    >
      <div className="cat-layout">
        <div className="cat-chart">
          <Doughnut data={chartData} options={options} />
          <div className="cat-center" aria-hidden="true">
            <span className="cat-center-label">Total</span>
            <Amount value={total} compact className="cat-center-value" />
          </div>
        </div>
        <ul className="cat-legend">
          {grouped.slice(0, 6).map(g => (
            <li key={g.name}>
              <span className="cat-dot" style={{ background: g.color || UNCATEGORISED }} aria-hidden="true" />
              <span className="cat-legend-name">{g.name}</span>
              <span className="cat-legend-pct num">{Math.round((g.total / total) * 100)}%</span>
            </li>
          ))}
        </ul>
      </div>
    </ChartCard>
  );
}

export default memo(CategoryBreakdown);
