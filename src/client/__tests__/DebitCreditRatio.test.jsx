/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import DebitCreditRatio from '../components/DebitCreditRatio';

vi.mock('react-chartjs-2', () => ({
  Doughnut: ({ data }) => (
    <div data-testid="doughnut-chart">
      <div data-testid="chart-labels">{JSON.stringify(data.labels)}</div>
      <div data-testid="chart-data">{JSON.stringify(data.datasets[0].data)}</div>
    </div>
  )
}));

vi.mock('chart.js', () => ({
  Chart: { register: () => {} },
  CategoryScale: class {},
  LinearScale: class {},
  BarElement: class {},
  LineElement: class {},
  PointElement: class {},
  ArcElement: class {},
  Filler: class {},
  Title: class {},
  Tooltip: class {},
  Legend: class {}
}));

const makeData = (overrides = []) => overrides.map((o, i) => ({
  Date: new Date(`2025-01-${15 + i}`),
  Amount: 100,
  IsCredit: false,
  Type: 'Debit',
  Description: `Merchant${i}`,
  ...o,
}));

describe('DebitCreditRatio', () => {
  it('shows empty message for null data', () => {
    render(<DebitCreditRatio data={null} />);
    expect(screen.getByText('No data available.')).toBeInTheDocument();
  });

  it('shows empty message for empty array', () => {
    render(<DebitCreditRatio data={[]} />);
    expect(screen.getByText('No data available.')).toBeInTheDocument();
  });

  it('shows no transactions message when totals are zero', () => {
    // All amounts are 0
    const data = makeData([{ Amount: 0 }, { Amount: 0 }]);
    render(<DebitCreditRatio data={data} />);
    expect(screen.getByText('No transactions found.')).toBeInTheDocument();
  });

  it('renders chart with correct data values', () => {
    const data = makeData([
      { Amount: 500, IsCredit: false },
      { Amount: 300, IsCredit: false },
      { Amount: 200, IsCredit: true, Type: 'Credit' },
    ]);

    render(<DebitCreditRatio data={data} />);

    const chartData = JSON.parse(screen.getByTestId('chart-data').textContent);
    expect(chartData).toEqual([800, 200]); // debits, credits
  });

  it('renders chart with correct labels', () => {
    const data = makeData([
      { Amount: 100, IsCredit: false },
      { Amount: 50, IsCredit: true, Type: 'Credit' },
    ]);

    render(<DebitCreditRatio data={data} />);

    const labels = JSON.parse(screen.getByTestId('chart-labels').textContent);
    expect(labels).toEqual(['Debits (Expenses)', 'Credits (Payments)']);
  });

  it('displays formatted debit amount in legend', () => {
    const data = makeData([
      { Amount: 1500, IsCredit: false },
      { Amount: 500, IsCredit: true, Type: 'Credit' },
    ]);

    render(<DebitCreditRatio data={data} />);

    const debitValue = document.querySelector('.ratio-value.debit');
    expect(debitValue).toBeInTheDocument();
    expect(debitValue.textContent).toContain('1,500');
  });

  it('displays formatted credit amount in legend', () => {
    const data = makeData([
      { Amount: 1500, IsCredit: false },
      { Amount: 500, IsCredit: true, Type: 'Credit' },
    ]);

    render(<DebitCreditRatio data={data} />);

    const creditValue = document.querySelector('.ratio-value.credit');
    expect(creditValue).toBeInTheDocument();
    expect(creditValue.textContent).toContain('500');
  });

  it('displays title and subtitle', () => {
    const data = makeData([{ Amount: 100 }]);

    render(<DebitCreditRatio data={data} />);

    expect(screen.getByText('Debit / Credit Ratio')).toBeInTheDocument();
    expect(screen.getByText('Overall spending breakdown')).toBeInTheDocument();
  });
});
