/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, within } from '@testing-library/react';
import AnalyticsDashboard from '../pages/AnalyticsDashboard';
import { makeTx, renderWithProviders, setSettings } from './testUtils';

vi.mock('react-chartjs-2', () => ({
  Line: ({ data }) => (
    <div data-testid="line-chart">
      <div data-testid="line-labels">{JSON.stringify(data.labels)}</div>
    </div>
  ),
  Doughnut: ({ data }) => (
    <div data-testid="doughnut-chart">
      <div data-testid="doughnut-data">{JSON.stringify(data.datasets[0].data)}</div>
    </div>
  ),
  Bar: ({ data }) => (
    <div data-testid="bar-chart">
      <div data-testid="bar-labels">{JSON.stringify(data.labels)}</div>
    </div>
  ),
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
  Legend: class {},
}));

const data = makeTx([
  { date: '2025-01-15', amount: 100, description: 'Store A', categoryId: 1, categoryName: 'Dining', categoryColor: '#fb923c' },
  { date: '2025-01-18', amount: 150, description: 'Store B', categoryId: 2, categoryName: 'Shopping', categoryColor: '#a78bfa' },
  { date: '2025-01-20', amount: 40, description: 'Refund', credit: true },
  { date: '2024-11-05', amount: 999, description: 'Old purchase' },
]);

describe('Insights (AnalyticsDashboard)', () => {
  beforeEach(() => {
    localStorage.clear();
    setSettings({ showCredits: true });
  });

  it('shows an empty state for null / empty csvData', () => {
    renderWithProviders(<AnalyticsDashboard csvData={null} />);
    expect(screen.getByText('No data yet')).toBeInTheDocument();
  });

  it('renders all chart sections for the default (latest) period', () => {
    renderWithProviders(<AnalyticsDashboard csvData={data} />, { csvData: data });
    expect(screen.getByText('Spending trends')).toBeInTheDocument();
    expect(screen.getByText('Category split')).toBeInTheDocument();
    expect(screen.getByText('Top merchants')).toBeInTheDocument();
    expect(screen.getByText('Debit vs credit')).toBeInTheDocument();
    expect(screen.getByText('Day-of-week pattern')).toBeInTheDocument();
  });

  it('uses only the global period: the old Nov purchase is excluded by default', () => {
    renderWithProviders(<AnalyticsDashboard csvData={data} />, { csvData: data });
    const merchants = screen.getAllByTestId('bar-labels').map(n => JSON.parse(n.textContent)).flat();
    expect(merchants).toContain('Store A');
    expect(merchants).not.toContain('Old purchase');
    expect(screen.getByText(/3/, { selector: '.num' })).toBeInTheDocument();
  });

  it('includes everything with period=all from the URL', () => {
    renderWithProviders(<AnalyticsDashboard csvData={data} />, { csvData: data, route: '/analytics?period=all' });
    const merchants = screen.getAllByTestId('bar-labels').map(n => JSON.parse(n.textContent)).flat();
    expect(merchants).toContain('Old purchase');
  });

  it('has Monthly selected by default and switches to Weekly', () => {
    renderWithProviders(<AnalyticsDashboard csvData={data} />, { csvData: data });
    const group = screen.getByRole('radiogroup', { name: 'Granularity' });
    expect(within(group).getByRole('radio', { name: 'Monthly' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByText('Monthly spending over time')).toBeInTheDocument();
    fireEvent.click(within(group).getByRole('radio', { name: 'Weekly' }));
    expect(screen.getByText('Weekly spending over time')).toBeInTheDocument();
  });

  it('shows an empty-period message when the card filter matches nothing in range', () => {
    const cards = [{ id: 1, card_label: 'A' }, { id: 2, card_label: 'B' }];
    renderWithProviders(<AnalyticsDashboard csvData={data} />, { csvData: data, cards, route: '/analytics?card=2' });
    expect(screen.getByText('Nothing in this period')).toBeInTheDocument();
  });
});

describe('Insights with showCredits=false', () => {
  beforeEach(() => {
    localStorage.clear();
    setSettings({ showCredits: false });
  });

  it('hides the debit vs credit chart and widens the weekday chart', () => {
    const { container } = renderWithProviders(<AnalyticsDashboard csvData={data} />, { csvData: data });
    expect(screen.queryByText('Debit vs credit')).not.toBeInTheDocument();
    const weekday = screen.getByText('Day-of-week pattern').closest('.span-12, .span-6');
    expect(weekday).toHaveClass('span-12');
    expect(container.querySelector('.debit-credit-ratio')).toBeNull();
  });
});
