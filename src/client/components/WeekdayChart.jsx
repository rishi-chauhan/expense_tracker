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
import { spendByWeekday } from '../utils/dataProcessing.js';
import ChartCard from './ChartCard';
import './WeekdayChart.css';

const FULL_DAY = { Mon: 'Monday', Tue: 'Tuesday', Wed: 'Wednesday', Thu: 'Thursday', Fri: 'Friday', Sat: 'Saturday', Sun: 'Sunday' };

/** Average spend per weekday — cheap to compute from precomputed timestamps. */
function WeekdayChart({ data }) {
  const chartColors = useChartTheme();
  const days = useMemo(() => spendByWeekday(data || []), [data]);
  const peak = useMemo(() => days.reduce((a, b) => (b.average > a.average ? b : a), days[0]), [days]);

  const { chartData, chartOptions } = useMemo(() => ({
    chartData: {
      labels: days.map(d => d.day),
      datasets: [{
        label: 'Average spend',
        data: days.map(d => d.average),
        backgroundColor: days.map(d => (d.day === peak.day ? chartColors.accent : chartColors.accentFill)),
        hoverBackgroundColor: chartColors.accent,
        borderRadius: 4,
        maxBarThickness: 28,
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
          callbacks: {
            title: (items) => FULL_DAY[items[0].label],
            label: (ctx) => `Average: ${money(chartColors, ctx.parsed.y)}`,
          },
        },
      },
      scales: { x: getXScale(chartColors), y: getYScale(chartColors) },
      animation: sharedAnimation,
    },
  }), [days, peak, chartColors]);

  if (!data || data.length === 0 || !peak || peak.average === 0) {
    return null;
  }

  return (
    <ChartCard
      className="weekday-chart"
      title="Day-of-week pattern"
      subtitle={`You spend most on ${FULL_DAY[peak.day]}s`}
      summary={`Average daily spending is highest on ${FULL_DAY[peak.day]}.`}
      height="md"
    >
      <Bar data={chartData} options={chartOptions} />
    </ChartCard>
  );
}

export default memo(WeekdayChart);
