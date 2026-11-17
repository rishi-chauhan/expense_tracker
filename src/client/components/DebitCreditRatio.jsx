import React, { memo, useMemo } from 'react';
import { Doughnut } from 'react-chartjs-2';
import { getTooltipConfig, sharedAnimation, chartDevicePixelRatio, money } from '../utils/chartConfig.js';
import { useChartTheme } from '../hooks/useChartTheme';
import { calculateSummaryStats } from '../utils/dataProcessing.js';
import ChartCard from './ChartCard';
import Amount from './ui/Amount';
import './DebitCreditRatio.css';

function DebitCreditRatio({ data }) {
  const chartColors = useChartTheme();
  const { totalDebits, totalCredits } = useMemo(() => calculateSummaryStats(data || []), [data]);

  const { chartData, chartOptions } = useMemo(() => ({
    chartData: {
      labels: ['Debits (Expenses)', 'Credits (Payments)'],
      datasets: [{
        data: [totalDebits, totalCredits],
        backgroundColor: [chartColors.debitSolid, chartColors.creditSolid],
        borderColor: chartColors.doughnutBorder,
        borderWidth: 2,
        hoverOffset: 4,
      }],
    },
    chartOptions: {
      responsive: true,
      maintainAspectRatio: false,
      devicePixelRatio: chartDevicePixelRatio,
      cutout: '70%',
      plugins: {
        legend: { display: false },
        tooltip: {
          ...getTooltipConfig(chartColors),
          callbacks: {
            label: (ctx) => {
              const total = totalDebits + totalCredits;
              const pct = total ? ((ctx.parsed / total) * 100).toFixed(1) : '0';
              return `${ctx.label}: ${money(chartColors, ctx.parsed)} (${pct}%)`;
            },
          },
        },
      },
      animation: sharedAnimation,
    },
  }), [totalDebits, totalCredits, chartColors]);

  if (!data || data.length === 0) {
    return <p className="chart-empty">No data available.</p>;
  }
  if (totalDebits === 0 && totalCredits === 0) {
    return <p className="chart-empty">No transactions found.</p>;
  }

  const total = totalDebits + totalCredits;
  return (
    <ChartCard
      className="debit-credit-ratio"
      title="Debit vs credit"
      subtitle="Overall spending breakdown"
      summary={`Debits are ${Math.round((totalDebits / total) * 100)}% of all money moved.`}
      height="sm"
    >
      <div className="ratio-layout">
        <div className="ratio-chart">
          <Doughnut data={chartData} options={chartOptions} />
        </div>
        <dl className="ratio-legend">
          <div className="ratio-row">
            <dt><span className="ratio-dot is-debit" aria-hidden="true" />Debits</dt>
            <dd className="ratio-value debit"><Amount value={totalDebits} /></dd>
          </div>
          <div className="ratio-row">
            <dt><span className="ratio-dot is-credit" aria-hidden="true" />Credits</dt>
            <dd className="ratio-value credit"><Amount value={totalCredits} /></dd>
          </div>
        </dl>
      </div>
    </ChartCard>
  );
}

export default memo(DebitCreditRatio);
