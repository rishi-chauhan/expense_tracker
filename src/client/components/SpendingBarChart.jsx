import React, { memo, useMemo } from 'react';
import { Bar } from 'react-chartjs-2';
import {
  getTooltipConfig,
  getXScale,
  getYScale,
  sharedAnimation,
  chartDevicePixelRatio,
  money,
} from '../utils/chartConfig.js';
import { useChartTheme } from '../hooks/useChartTheme';
import { groupByMonth, groupByWeek } from '../utils/dataProcessing.js';
import './SpendingBarChart.css';

/**
 * Overview's "Spending over time" bars (lazy-loaded so Chart.js isn't in the
 * initial bundle). Weekly for short periods, monthly otherwise.
 */
function SpendingBarChart({ data, weekly }) {
  const chartColors = useChartTheme();

  const { labels, values } = useMemo(() => {
    if (weekly) {
      const { weeklyData, sortedWeeks } = groupByWeek(data);
      return { labels: sortedWeeks, values: sortedWeeks.map(k => weeklyData[k].debits) };
    }
    const { monthlyData, sortedMonths } = groupByMonth(data);
    return { labels: sortedMonths, values: sortedMonths.map(k => monthlyData[k].debits) };
  }, [data, weekly]);

  const { chartData, chartOptions } = useMemo(() => {
    const xScale = getXScale(chartColors);
    return {
      chartData: {
        labels,
        datasets: [{
          label: 'Spent',
          data: values,
          backgroundColor: chartColors.accent,
          hoverBackgroundColor: chartColors.accent,
          borderRadius: 4,
          maxBarThickness: 36,
        }],
      },
      chartOptions: {
        responsive: true,
        maintainAspectRatio: false,
        devicePixelRatio: chartDevicePixelRatio,
        plugins: {
          legend: { display: false },
          tooltip: {
            ...getTooltipConfig(chartColors),
            callbacks: { label: (ctx) => money(chartColors, ctx.parsed.y) },
          },
        },
        scales: {
          x: { ...xScale, ticks: { ...xScale.ticks, maxRotation: 0, autoSkip: true, maxTicksLimit: 8 } },
          y: getYScale(chartColors),
        },
        animation: sharedAnimation,
      },
    };
  }, [labels, values, chartColors]);

  return (
    <div className="spending-bar-chart">
      <Bar data={chartData} options={chartOptions} />
    </div>
  );
}

export default memo(SpendingBarChart);
