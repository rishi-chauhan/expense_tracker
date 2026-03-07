/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AnalyticsDashboard from '../pages/AnalyticsDashboard';

let mockShowCredits = true;
vi.mock('../contexts/SettingsContext', () => ({
  useSettings: () => ({ showCredits: mockShowCredits, toggleShowCredits: () => {} }),
}));

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
  Legend: class {}
}));

// Use dates within the same month so they all fall in the default 1-month window
const makeData = (overrides = []) => overrides.map((o, i) => ({
  Date: new Date(`2025-01-${String(15 + i).padStart(2, '0')}`),
  Amount: 100 + i * 50,
  IsCredit: false,
  Type: 'Debit',
  Description: `Store ${i}`,
  ...o,
}));

function renderWithRouter(ui) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

describe('AnalyticsDashboard', () => {
  beforeEach(() => {
    mockShowCredits = true;
  });

  it('shows empty state for null csvData', () => {
    renderWithRouter(<AnalyticsDashboard csvData={null} />);

    expect(screen.getByText('No Data Yet')).toBeInTheDocument();
    expect(screen.getByText(/Home page/)).toBeInTheDocument();
  });

  it('shows empty state for empty csvData', () => {
    renderWithRouter(<AnalyticsDashboard csvData={[]} />);

    expect(screen.getByText('No Data Yet')).toBeInTheDocument();
  });

  it('renders all child chart sections', () => {
    const data = makeData([
      { Amount: 300, Description: 'Grocery Store' },
      { Amount: 200, Description: 'Gas Station' },
      { Amount: 100, IsCredit: true, Type: 'Credit', Description: 'Refund' },
    ]);

    renderWithRouter(<AnalyticsDashboard csvData={data} />);

    expect(screen.getByText('Spending Trends')).toBeInTheDocument();
    expect(screen.getByText('Debit / Credit Ratio')).toBeInTheDocument();
    expect(screen.getByText('Top Merchants')).toBeInTheDocument();
    expect(screen.getByText('Transaction Explorer')).toBeInTheDocument();
  });

  it('renders search input', () => {
    const data = makeData([{ Amount: 100, Description: 'Test Store' }]);

    renderWithRouter(<AnalyticsDashboard csvData={data} />);

    const searchInput = screen.getByPlaceholderText('Search transactions...');
    expect(searchInput).toBeInTheDocument();
  });

  it('filters data when searching', () => {
    const data = makeData([
      { Amount: 300, Description: 'Grocery Store' },
      { Amount: 200, Description: 'Gas Station' },
    ]);

    renderWithRouter(<AnalyticsDashboard csvData={data} />);

    const searchInput = screen.getByPlaceholderText('Search transactions...');
    fireEvent.change(searchInput, { target: { value: 'Grocery' } });

    // Transaction Explorer should show only the matching transaction
    expect(screen.getByText('1 transaction')).toBeInTheDocument();
  });

  it('has Monthly active by default in granularity toggle', () => {
    const data = makeData([{ Amount: 100, Description: 'Store' }]);

    renderWithRouter(<AnalyticsDashboard csvData={data} />);

    const monthlyBtn = screen.getByText('Monthly');
    const weeklyBtn = screen.getByText('Weekly');

    expect(monthlyBtn.className).toContain('active');
    expect(weeklyBtn.className).not.toContain('active');
  });

  it('switches granularity and updates subtitle', () => {
    const data = makeData([{ Amount: 100, Description: 'Store' }]);

    renderWithRouter(<AnalyticsDashboard csvData={data} />);

    // Default: monthly
    expect(screen.getByText('Monthly spending over time')).toBeInTheDocument();

    // Click Weekly
    fireEvent.click(screen.getByText('Weekly'));

    expect(screen.getByText('Weekly').className).toContain('active');
    expect(screen.getByText('Monthly').className).not.toContain('active');
    expect(screen.getByText('Weekly spending over time')).toBeInTheDocument();
  });

  it('shows clear button when search has text', () => {
    const data = makeData([{ Amount: 100, Description: 'Store' }]);

    renderWithRouter(<AnalyticsDashboard csvData={data} />);

    // No clear button initially (no non-default filters)
    expect(screen.queryByText('Clear')).not.toBeInTheDocument();

    // Type in search — use a term that still matches data so only one Clear button appears
    const searchInput = screen.getByPlaceholderText('Search transactions...');
    fireEvent.change(searchInput, { target: { value: 'Store' } });

    expect(screen.getByText('Clear')).toBeInTheDocument();
  });

  it('clears filters when Clear button is clicked', () => {
    const data = makeData([
      { Amount: 300, Description: 'Grocery Store' },
      { Amount: 200, Description: 'Gas Station' },
    ]);

    renderWithRouter(<AnalyticsDashboard csvData={data} />);

    // Apply a search filter
    const searchInput = screen.getByPlaceholderText('Search transactions...');
    fireEvent.change(searchInput, { target: { value: 'Grocery' } });

    expect(screen.getByText('1 transaction')).toBeInTheDocument();

    // Click Clear
    fireEvent.click(screen.getByText('Clear'));

    // Search should be cleared
    expect(searchInput.value).toBe('');
  });

  it('shows no results message for nonexistent search', () => {
    const data = makeData([{ Amount: 100, Description: 'Store' }]);

    renderWithRouter(<AnalyticsDashboard csvData={data} />);

    const searchInput = screen.getByPlaceholderText('Search transactions...');
    fireEvent.change(searchInput, { target: { value: 'xyznonexistent' } });

    expect(screen.getByText('No transactions match your filters.')).toBeInTheDocument();
  });
});

describe('AnalyticsDashboard with showCredits=false', () => {
  beforeEach(() => {
    mockShowCredits = false;
  });

  it('hides DebitCreditRatio component', () => {
    const data = makeData([
      { Amount: 300, Description: 'Grocery Store' },
      { Amount: 100, IsCredit: true, Type: 'Credit', Description: 'Refund' },
    ]);

    renderWithRouter(<AnalyticsDashboard csvData={data} />);

    expect(screen.getByText('Spending Trends')).toBeInTheDocument();
    expect(screen.queryByText('Debit / Credit Ratio')).not.toBeInTheDocument();
  });

  it('uses full-width layout for SpendingTrends', () => {
    const data = makeData([{ Amount: 100, Description: 'Store' }]);

    renderWithRouter(<AnalyticsDashboard csvData={data} />);

    const grid = document.querySelector('.analytics-charts-grid');
    expect(grid.className).toContain('full-width');
  });
});
