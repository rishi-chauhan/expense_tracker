import React, { memo, useMemo } from 'react';
import { Bar } from 'react-chartjs-2';
import { getTooltipConfig, sharedAnimation, chartDevicePixelRatio, money } from '../utils/chartConfig.js';
import { useChartTheme } from '../hooks/useChartTheme';
import { groupByDescription } from '../utils/dataProcessing.js';
import ChartCard from './ChartCard';
import './TopMerchants.css';

function TopMerchants({ data }) {
  const chartColors = useChartTheme();
  const merchants = useMemo(
    () => (data && data.length ? groupByDescription(data).slice(0, 10) : []),
    [data]
  );

  const { chartData, chartOptions } = useMemo(() => {
    const labels = merchants.map(m =>
      m.description.length > 30 ? m.description.slice(0, 27) + '...' : m.description
    );
    return {
      chartData: {
        labels,
        datasets: [{
          label: 'Total spent',
          data: merchants.map(m => m.total),
          backgroundColor: chartColors.accent,
          hoverBackgroundColor: chartColors.accent,
          borderRadius: 4,
          borderSkipped: false,
          barThickness: 'flex',
          maxBarThickness: 18,
        }],
      },
      chartOptions: {
        responsive: true,
        maintainAspectRatio: false,
        devicePixelRatio: chartDevicePixelRatio,
        indexAxis: 'y',
        plugins: {
          legend: { display: false },
          tooltip: {
            ...getTooltipConfig(chartColors),
            callbacks: {
              title: (items) => merchants[items[0].dataIndex]?.description,
              label: (ctx) => {
                const m = merchants[ctx.dataIndex];
                return [
                  `Total: ${money(chartColors, ctx.parsed.x)}`,
                  `${m.count} transaction${m.count !== 1 ? 's' : ''}`,
                ];
              },
            },
          },
        },
        scales: {
          x: {
            grid: { color: chartColors.gridColor },
            border: { display: false },
            ticks: {
              font: { family: chartColors.font, size: 11 },
              color: chartColors.tickColorSecondary,
              maxTicksLimit: 5,
              callback: (value) => money(chartColors, value, { compact: true }),
            },
          },
          y: {
            grid: { display: false },
            border: { color: chartColors.borderColor },
            ticks: { font: { family: chartColors.font, size: 12 }, color: chartColors.tickColorPrimary },
          },
        },
        animation: sharedAnimation,
      },
    };
  }, [merchants, chartColors]);

  if (!data || data.length === 0) {
    return <p className="chart-empty">No data available for top merchants.</p>;
  }
  if (merchants.length === 0) {
    return <p className="chart-empty">No debit transactions found.</p>;
  }

  return (
    <ChartCard
      className="top-merchants"
      title="Top merchants"
      subtitle="Highest spending by merchant"
      summary={`Top merchant: ${merchants[0].description}, ${merchants[0].count} transactions.`}
      height="lg"
    >
      <Bar data={chartData} options={chartOptions} />
    </ChartCard>
  );
}

export default memo(TopMerchants);
