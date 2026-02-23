/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import SpendingTrends from '../components/SpendingTrends';

let mockShowCredits = true;
vi.mock('../contexts/SettingsContext', () => ({
  useSettings: () => ({ showCredits: mockShowCredits, toggleShowCredits: () => {} }),
}));

vi.mock('react-chartjs-2', () => ({
  Line: ({ data }) => (
    <div data-testid="line-chart">
      <div data-testid="chart-labels">{JSON.stringify(data.labels)}</div>
      <div data-testid="chart-datasets">{JSON.stringify(data.datasets.map(d => d.label))}</div>
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

describe('SpendingTrends', () => {
  beforeEach(() => {
    mockShowCredits = true;
  });

  it('shows empty message for null data', () => {
    render(<SpendingTrends data={null} granularity="monthly" />);
    expect(screen.getByText('No data available for spending trends.')).toBeInTheDocument();
  });

  it('shows empty message for empty array', () => {
    render(<SpendingTrends data={[]} granularity="monthly" />);
    expect(screen.getByText('No data available for spending trends.')).toBeInTheDocument();
  });

  it('renders line chart with monthly data', () => {
    const data = makeData([
      { Date: new Date('2025-01-15'), Amount: 100 },
      { Date: new Date('2025-02-10'), Amount: 200 },
    ]);

    render(<SpendingTrends data={data} granularity="monthly" />);

    expect(screen.getByTestId('line-chart')).toBeInTheDocument();
    const labels = JSON.parse(screen.getByTestId('chart-labels').textContent);
    expect(labels.length).toBeGreaterThanOrEqual(2);
  });

  it('defaults to only Debits active', () => {
    const data = makeData([
      { Date: new Date('2025-01-15'), Amount: 100 },
      { Date: new Date('2025-01-20'), Amount: 50, IsCredit: true, Type: 'Credit' },
    ]);

    render(<SpendingTrends data={data} granularity="monthly" />);

    const datasets = JSON.parse(screen.getByTestId('chart-datasets').textContent);
    expect(datasets).toEqual(['Debits']);

    // Credits button should have inactive class
    const creditsButton = screen.getByText('Credits').closest('button');
    expect(creditsButton.className).toContain('inactive');
  });

  it('shows both datasets after clicking Credits', () => {
    const data = makeData([
      { Date: new Date('2025-01-15'), Amount: 100 },
      { Date: new Date('2025-01-20'), Amount: 50, IsCredit: true, Type: 'Credit' },
    ]);

    render(<SpendingTrends data={data} granularity="monthly" />);

    fireEvent.click(screen.getByText('Credits').closest('button'));

    const datasets = JSON.parse(screen.getByTestId('chart-datasets').textContent);
    expect(datasets).toEqual(['Debits', 'Credits']);

    // Both buttons should be active
    const debitsButton = screen.getByText('Debits').closest('button');
    const creditsButton = screen.getByText('Credits').closest('button');
    expect(debitsButton.className).not.toContain('inactive');
    expect(creditsButton.className).not.toContain('inactive');
  });

  it('cannot deselect the last active dataset', () => {
    const data = makeData([
      { Date: new Date('2025-01-15'), Amount: 100 },
    ]);

    render(<SpendingTrends data={data} granularity="monthly" />);

    // Debits is the only active dataset — clicking it should not deactivate
    fireEvent.click(screen.getByText('Debits').closest('button'));

    const datasets = JSON.parse(screen.getByTestId('chart-datasets').textContent);
    expect(datasets).toEqual(['Debits']);
  });

  it('shows monthly subtitle when granularity is monthly', () => {
    const data = makeData([{ Date: new Date('2025-01-15'), Amount: 100 }]);

    render(<SpendingTrends data={data} granularity="monthly" />);

    expect(screen.getByText('Monthly spending over time')).toBeInTheDocument();
  });

  it('shows weekly subtitle when granularity is weekly', () => {
    const data = makeData([{ Date: new Date('2025-01-15'), Amount: 100 }]);

    render(<SpendingTrends data={data} granularity="weekly" />);

    expect(screen.getByText('Weekly spending over time')).toBeInTheDocument();
  });
});

describe('SpendingTrends with showCredits=false', () => {
  beforeEach(() => {
    mockShowCredits = false;
  });

  it('hides credits toggle button', () => {
    const data = makeData([
      { Date: new Date('2025-01-15'), Amount: 100 },
      { Date: new Date('2025-01-20'), Amount: 50, IsCredit: true, Type: 'Credit' },
    ]);

    render(<SpendingTrends data={data} granularity="monthly" />);

    expect(screen.getByText('Debits')).toBeInTheDocument();
    expect(screen.queryByText('Credits')).not.toBeInTheDocument();
  });

  it('only shows debits dataset', () => {
    const data = makeData([
      { Date: new Date('2025-01-15'), Amount: 100 },
      { Date: new Date('2025-01-20'), Amount: 50, IsCredit: true, Type: 'Credit' },
    ]);

    render(<SpendingTrends data={data} granularity="monthly" />);

    const datasets = JSON.parse(screen.getByTestId('chart-datasets').textContent);
    expect(datasets).toEqual(['Debits']);
  });
});
