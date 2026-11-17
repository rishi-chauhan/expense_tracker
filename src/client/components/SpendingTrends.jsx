import React, { memo, useMemo, useState } from 'react';
import { Line } from 'react-chartjs-2';
import {
  getTooltipConfig,
  getXScale,
  getYScale,
  sharedAnimation,
  chartDevicePixelRatio,
  money,
} from '../utils/chartConfig.js';
import { useChartTheme } from '../hooks/useChartTheme';
import { useSettings } from '../contexts/SettingsContext';
import { groupByMonth, groupByWeek } from '../utils/dataProcessing.js';
import ChartCard from './ChartCard';
import Chip from './ui/Chip';
import './SpendingTrends.css';

function SpendingTrends({ data, granularity }) {
  const [activeDatasets, setActiveDatasets] = useState({ debits: true, credits: false });
  const chartColors = useChartTheme();
  const { showCredits } = useSettings();
  const isWeekly = granularity === 'weekly';

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
    const series = (key, label, solid, fill) => ({
      key,
      label,
      data: labels.map(l => groupedData[l][key]),
      borderColor: solid,
      backgroundColor: fill,
      borderWidth: 2,
      fill: true,
      tension: 0.3,
      pointRadius: dense ? 0 : 3,
      pointHoverRadius: 5,
      pointBackgroundColor: solid,
      pointBorderColor: chartColors.pointBorderColor,
      pointBorderWidth: 2,
    });
    const datasets = [
      series('debits', 'Debits', chartColors.accent, chartColors.accentFill),
      ...(showCredits ? [series('credits', 'Credits', chartColors.creditSolid, chartColors.creditFill)] : []),
    ];
    return { labels, datasets: datasets.filter(ds => activeDatasets[ds.key]) };
  }, [labels, groupedData, chartColors, showCredits, activeDatasets]);

  const chartOptions = useMemo(() => {
    const xScale = getXScale(chartColors);
    return {
      responsive: true,
      maintainAspectRatio: false,
      devicePixelRatio: chartDevicePixelRatio,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          ...getTooltipConfig(chartColors),
          callbacks: {
            label: (ctx) => `${ctx.dataset.label}: ${money(chartColors, ctx.parsed.y)}`,
          },
        },
      },
      scales: {
        x: { ...xScale, ticks: { ...xScale.ticks, maxRotation: 0, autoSkip: true, maxTicksLimit: 8 } },
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

  const peak = labels.reduce((best, l) => (groupedData[l].debits > (groupedData[best]?.debits ?? -1) ? l : best), labels[0]);

  return (
    <ChartCard
      className="spending-trends"
      title="Spending trends"
      subtitle={`${isWeekly ? 'Weekly' : 'Monthly'} spending over time`}
      summary={`${labels.length} ${isWeekly ? 'weeks' : 'months'} shown. Highest spending: ${peak}.`}
      height="lg"
      actions={showCredits && (
        <div className="chart-legend">
          {['debits', 'credits'].map(key => (
            <Chip
              key={key}
              className={`legend-item${activeDatasets[key] ? '' : ' inactive'}`}
              selected={activeDatasets[key]}
              color={key === 'debits' ? chartColors.accent : chartColors.creditSolid}
              onClick={() => toggleDataset(key)}
            >
              {key === 'debits' ? 'Debits' : 'Credits'}
            </Chip>
          ))}
        </div>
      )}
    >
      <Line data={chartData} options={chartOptions} />
    </ChartCard>
  );
}

export default memo(SpendingTrends);
