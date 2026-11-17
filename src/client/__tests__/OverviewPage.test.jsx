/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, within, waitFor } from '@testing-library/react';
import OverviewPage from '../pages/OverviewPage';
import { makeTx, makeFetchMock, renderWithProviders, setSettings } from './testUtils';

vi.mock('react-chartjs-2', () => ({
  Bar: ({ data }) => <div data-testid="bar-chart">{JSON.stringify(data.labels)}</div>,
}));

const data = makeTx([
  { id: 1, date: '2025-03-10', amount: 1000, description: 'SWIGGY', categoryId: 2, categoryName: 'Dining', categoryColor: '#fb923c' },
  { id: 2, date: '2025-03-12', amount: 3000, description: 'AMAZON', categoryId: 5, categoryName: 'Shopping', categoryColor: '#a78bfa' },
  { id: 3, date: '2025-03-14', amount: 1000, description: 'SWIGGY', categoryId: 2, categoryName: 'Dining', categoryColor: '#fb923c' },
  { id: 4, date: '2025-02-01', amount: 2500, description: 'OLD MONTH' },
  { id: 5, date: '2025-03-15', amount: 400, description: 'CASHBACK', credit: true },
]);

function renderOverview(opts = {}) {
  return renderWithProviders(
    <OverviewPage csvData={opts.csvData ?? data} loading={false} dataKey={1} onFileUpload={vi.fn()} onUploadError={vi.fn()} />,
    { csvData: opts.csvData ?? data, route: opts.route ?? '/' }
  );
}

describe('OverviewPage', () => {
  beforeEach(() => {
    global.fetch = makeFetchMock({
      '/api/budgets': { success: true, yearMonth: '2025-03', budgets: [
        { id: 1, category_id: 2, category_name: 'Dining', category_color: '#fb923c', amount: 2400, spent: 2000 },
      ] },
      '/api/recurring': { success: true, recurring: [{ description: 'NETFLIX', avgAmount: 649, lastDate: '2025-03-02' }] },
    });
  });

  it('answers the question with the period total as the hero', () => {
    renderOverview();
    const hero = screen.getByRole('heading', { name: /went out/ });
    // 1000 + 3000 + 1000 in the latest month; OLD MONTH excluded
    expect(hero).toHaveTextContent('₹5,000');
    expect(hero).toHaveTextContent('from 16 Feb to 15 Mar 2025');
  });

  it('draws the money strip with category links carrying the filters', () => {
    renderOverview({ route: '/?period=3m' });
    const strip = screen.getByRole('list', { name: 'Spending by category' });
    const shopping = within(strip).getByRole('link', { name: /Shopping/ });
    expect(shopping.getAttribute('href')).toBe('/transactions?period=3m&category=5');
    expect(shopping).toHaveAccessibleName(/Shopping: ₹3,000.00, \d+%/);
  });

  it('compares with the previous period', () => {
    renderOverview();
    expect(screen.getByText('Compared with before')).toBeInTheDocument();
    expect(screen.getByText(/100% more than the period before/)).toBeInTheDocument();
  });

  it('lists categories, top merchants and recent transactions', () => {
    renderOverview();
    expect(screen.getByText('Where it went')).toBeInTheDocument();
    const merchants = screen.getByText('Top merchants').closest('.card');
    expect(within(merchants).getAllByRole('listitem')[0]).toHaveTextContent('AMAZON');
    const recent = screen.getByText('Recent transactions').closest('.card');
    expect(within(recent).getAllByRole('listitem')[0]).toHaveTextContent('SWIGGY');
    expect(within(recent).getByRole('link', { name: 'View all' })).toHaveAttribute('href', '/transactions');
  });

  it('shows budgets and recurring from the API', async () => {
    renderOverview();
    const budgets = screen.getByText('Budgets').closest('.card');
    await waitFor(() => expect(within(budgets).getByText('Dining')).toBeInTheDocument());
    expect(budgets.querySelector('.pr-fill.is-warning')).not.toBeNull(); // 83%
    expect(await screen.findByText('NETFLIX')).toBeInTheDocument();
  });

  it('hides credit tiles unless show credits is on', () => {
    const { unmount } = renderOverview();
    expect(screen.queryByText('Net')).not.toBeInTheDocument();
    unmount();
    setSettings({ showCredits: true });
    renderOverview();
    expect(screen.getByText('Credits')).toBeInTheDocument();
    expect(screen.getByText('Net')).toBeInTheDocument();
  });

  it('shows an empty-period message', () => {
    renderOverview({ route: '/?period=custom&from=2020-01-01&to=2020-01-31' });
    expect(screen.getByText('Nothing in this period')).toBeInTheDocument();
  });

  it('shows the welcome upload card without data', () => {
    renderOverview({ csvData: [] });
    expect(screen.getByText('Upload your first statement')).toBeInTheDocument();
    expect(screen.getByLabelText(/Upload credit card statement/i)).toBeInTheDocument();
  });
});
