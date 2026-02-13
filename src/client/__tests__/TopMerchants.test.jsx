/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import TopMerchants from '../components/TopMerchants';

vi.mock('react-chartjs-2', () => ({
  Bar: ({ data }) => (
    <div data-testid="bar-chart">
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

describe('TopMerchants', () => {
  it('shows empty message for null data', () => {
    render(<TopMerchants data={null} />);
    expect(screen.getByText('No data available for top merchants.')).toBeInTheDocument();
  });

  it('shows empty message for empty array', () => {
    render(<TopMerchants data={[]} />);
    expect(screen.getByText('No data available for top merchants.')).toBeInTheDocument();
  });

  it('shows no debit transactions message when all are credits', () => {
    const data = makeData([
      { Amount: 100, IsCredit: true, Type: 'Credit', Description: 'Refund' },
      { Amount: 200, IsCredit: true, Type: 'Credit', Description: 'Payment' },
    ]);

    render(<TopMerchants data={data} />);
    expect(screen.getByText('No debit transactions found.')).toBeInTheDocument();
  });

  it('renders bar chart with merchant data', () => {
    const data = makeData([
      { Amount: 300, Description: 'Store A' },
      { Amount: 200, Description: 'Store B' },
    ]);

    render(<TopMerchants data={data} />);

    expect(screen.getByTestId('bar-chart')).toBeInTheDocument();
    const labels = JSON.parse(screen.getByTestId('chart-labels').textContent);
    expect(labels).toContain('Store A');
    expect(labels).toContain('Store B');
  });

  it('sorts merchants by total spend descending', () => {
    const data = makeData([
      { Amount: 100, Description: 'Low Spender' },
      { Amount: 500, Description: 'High Spender' },
      { Amount: 300, Description: 'Mid Spender' },
    ]);

    render(<TopMerchants data={data} />);

    const labels = JSON.parse(screen.getByTestId('chart-labels').textContent);
    expect(labels[0]).toBe('High Spender');
    expect(labels[1]).toBe('Mid Spender');
    expect(labels[2]).toBe('Low Spender');
  });

  it('limits to 10 merchants', () => {
    const data = makeData(
      Array.from({ length: 12 }, (_, i) => ({
        Amount: (12 - i) * 100,
        Description: `Merchant ${i + 1}`,
      }))
    );

    render(<TopMerchants data={data} />);

    const labels = JSON.parse(screen.getByTestId('chart-labels').textContent);
    expect(labels).toHaveLength(10);
  });

  it('truncates labels longer than 30 characters', () => {
    const longName = 'A'.repeat(35); // 35 chars
    const data = makeData([{ Amount: 100, Description: longName }]);

    render(<TopMerchants data={data} />);

    const labels = JSON.parse(screen.getByTestId('chart-labels').textContent);
    expect(labels[0]).toBe('A'.repeat(27) + '...');
    expect(labels[0].length).toBe(30);
  });

  it('displays title and subtitle', () => {
    const data = makeData([{ Amount: 100, Description: 'Store' }]);

    render(<TopMerchants data={data} />);

    expect(screen.getByText('Top Merchants')).toBeInTheDocument();
    expect(screen.getByText('Highest spending by merchant')).toBeInTheDocument();
  });
});
