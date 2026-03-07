/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Dashboard from '../components/Dashboard';

// Mock settings context - default to showing credits for existing tests
let mockShowCredits = true;
vi.mock('../contexts/SettingsContext', () => ({
  useSettings: () => ({ showCredits: mockShowCredits, toggleShowCredits: () => {} }),
}));

// Mock Chart.js components
vi.mock('react-chartjs-2', () => ({
  Line: ({ data }) => (
    <div data-testid="line-chart">
      <div data-testid="chart-labels">{JSON.stringify(data.labels)}</div>
      <div data-testid="chart-datasets">{JSON.stringify(data.datasets)}</div>
    </div>
  )
}));

vi.mock('chart.js', () => ({
  Chart: { register: () => {} },
  CategoryScale: class CategoryScale {},
  LinearScale: class LinearScale {},
  BarElement: class BarElement {},
  LineElement: class LineElement {},
  PointElement: class PointElement {},
  ArcElement: class ArcElement {},
  Filler: class Filler {},
  Title: class Title {},
  Tooltip: class Tooltip {},
  Legend: class Legend {}
}));

describe('Dashboard Component', () => {
  beforeEach(() => {
    mockShowCredits = true;
  });

  it('should show message when no data', () => {
    render(<Dashboard csvData={null} />);
    expect(screen.getByText(/Upload a CSV file to see your dashboard/i)).toBeInTheDocument();
  });

  it('should show message when data is empty array', () => {
    render(<Dashboard csvData={[]} />);
    expect(screen.getByText(/Upload a CSV file to see your dashboard/i)).toBeInTheDocument();
  });

  it('should calculate total debits correctly', () => {
    const mockData = [
      { Date: new Date('2025-01-01'), Amount: 100, IsCredit: false, Type: 'Debit', Description: 'Test1' },
      { Date: new Date('2025-01-02'), Amount: 200, IsCredit: false, Type: 'Debit', Description: 'Test2' },
      { Date: new Date('2025-01-03'), Amount: 50, IsCredit: true, Type: 'Credit', Description: 'Test3' }
    ];

    render(<Dashboard csvData={mockData} />);

    // Total debits should be 300.00
    expect(screen.getByText(/₹300\.00/)).toBeInTheDocument();
  });

  it('should calculate total credits correctly', () => {
    const mockData = [
      { Date: new Date('2025-01-01'), Amount: 100, IsCredit: false, Type: 'Debit', Description: 'Test1' },
      { Date: new Date('2025-01-02'), Amount: 50, IsCredit: true, Type: 'Credit', Description: 'Test2' },
      { Date: new Date('2025-01-03'), Amount: 25, IsCredit: true, Type: 'Credit', Description: 'Test3' }
    ];

    render(<Dashboard csvData={mockData} />);

    // Total credits should be 75.00
    expect(screen.getByText(/₹75\.00/)).toBeInTheDocument();
  });

  it('should calculate net spending correctly', () => {
    const mockData = [
      { Date: new Date('2025-01-01'), Amount: 500, IsCredit: false, Type: 'Debit', Description: 'Test1' },
      { Date: new Date('2025-01-02'), Amount: 200, IsCredit: true, Type: 'Credit', Description: 'Test2' }
    ];

    render(<Dashboard csvData={mockData} />);

    // Net spending should be 300.00 (500 - 200)
    expect(screen.getByText(/₹300\.00/)).toBeInTheDocument();
  });

  it('should display transaction count', () => {
    const mockData = [
      { Date: new Date('2025-01-01'), Amount: 100, IsCredit: false, Type: 'Debit', Description: 'Test1' },
      { Date: new Date('2025-01-02'), Amount: 200, IsCredit: false, Type: 'Debit', Description: 'Test2' }
    ];

    render(<Dashboard csvData={mockData} />);

    expect(screen.getByText(/2 transactions/i)).toBeInTheDocument();
  });

  it('should group transactions by month correctly', () => {
    const mockData = [
      { Date: new Date('2025-01-15'), Amount: 100, IsCredit: false, Type: 'Debit', Description: 'Jan1' },
      { Date: new Date('2025-01-20'), Amount: 200, IsCredit: false, Type: 'Debit', Description: 'Jan2' },
      { Date: new Date('2025-02-10'), Amount: 150, IsCredit: false, Type: 'Debit', Description: 'Feb1' },
      { Date: new Date('2025-03-05'), Amount: 100, IsCredit: false, Type: 'Debit', Description: 'Mar1' }
    ];

    render(<Dashboard csvData={mockData} />);

    // Default is 1M — select All to see all months
    fireEvent.click(screen.getByText('All'));

    // Should show 3 months
    expect(screen.getByText(/3 months/i)).toBeInTheDocument();
  });

  it('should render line chart with correct labels', () => {
    const mockData = [
      { Date: new Date('2025-01-15'), Amount: 100, IsCredit: false, Type: 'Debit', Description: 'Test' },
      { Date: new Date('2025-02-10'), Amount: 200, IsCredit: false, Type: 'Debit', Description: 'Test' }
    ];

    render(<Dashboard csvData={mockData} />);

    // Default is 1M — select All to see all months
    fireEvent.click(screen.getByText('All'));

    const chartLabels = screen.getByTestId('chart-labels');
    const labelsData = JSON.parse(chartLabels.textContent);

    expect(labelsData).toContain('Jan 2025');
    expect(labelsData).toContain('Feb 2025');
  });

  it('should have a single spending dataset', () => {
    const mockData = [
      { Date: new Date('2025-01-15'), Amount: 300, IsCredit: false, Type: 'Debit', Description: 'Debit1' },
      { Date: new Date('2025-01-20'), Amount: 100, IsCredit: true, Type: 'Credit', Description: 'Credit1' }
    ];

    render(<Dashboard csvData={mockData} />);

    const chartDatasets = screen.getByTestId('chart-datasets');
    const datasets = JSON.parse(chartDatasets.textContent);

    expect(datasets).toHaveLength(1);
    expect(datasets[0].label).toBe('Total Spending');
  });

  it('should handle invalid dates gracefully', () => {
    const mockData = [
      { Date: new Date('2025-01-15'), Amount: 100, IsCredit: false, Type: 'Debit', Description: 'Valid' },
      { Date: new Date('invalid'), Amount: 200, IsCredit: false, Type: 'Debit', Description: 'Invalid' },
      { Date: null, Amount: 300, IsCredit: false, Type: 'Debit', Description: 'Null' }
    ];

    render(<Dashboard csvData={mockData} />);

    // Should only process valid date (100) — appears in both Total Debits and Net Spending
    expect(screen.getAllByText(/₹100\.00/).length).toBeGreaterThanOrEqual(1);
  });

  it('should handle missing amount fields gracefully', () => {
    const mockData = [
      { Date: new Date('2025-01-15'), Amount: 100, IsCredit: false, Type: 'Debit', Description: 'Valid' },
      { Date: new Date('2025-01-16'), Amount: null, IsCredit: false, Type: 'Debit', Description: 'NoAmount' },
      { Date: new Date('2025-01-17'), IsCredit: false, Type: 'Debit', Description: 'MissingAmount' }
    ];

    render(<Dashboard csvData={mockData} />);

    // Should only process valid amount (100) — appears in both Total Debits and Net Spending
    expect(screen.getAllByText(/₹100\.00/).length).toBeGreaterThanOrEqual(1);
  });

  it('should sort months chronologically', () => {
    const mockData = [
      { Date: new Date('2025-03-15'), Amount: 100, IsCredit: false, Type: 'Debit', Description: 'Mar' },
      { Date: new Date('2025-01-10'), Amount: 200, IsCredit: false, Type: 'Debit', Description: 'Jan' },
      { Date: new Date('2025-02-20'), Amount: 150, IsCredit: false, Type: 'Debit', Description: 'Feb' }
    ];

    render(<Dashboard csvData={mockData} />);

    // Default is 1M — select All to see all months
    fireEvent.click(screen.getByText('All'));

    const chartLabels = screen.getByTestId('chart-labels');
    const labelsData = JSON.parse(chartLabels.textContent);

    expect(labelsData[0]).toBe('Jan 2025');
    expect(labelsData[1]).toBe('Feb 2025');
    expect(labelsData[2]).toBe('Mar 2025');
  });

  it('should display zero values when no credits or debits', () => {
    const mockData = [
      { Date: new Date('2025-01-15'), Amount: 100, IsCredit: false, Type: 'Debit', Description: 'Test' }
    ];

    render(<Dashboard csvData={mockData} />);

    // Debits = 100, Net = 100 (same value appears twice), credits = 0
    expect(screen.getAllByText(/₹100\.00/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/₹0\.00/)).toBeInTheDocument();
  });

  it('should format amounts with Indian locale', () => {
    const mockData = [
      { Date: new Date('2025-01-15'), Amount: 123456.78, IsCredit: false, Type: 'Debit', Description: 'Test' }
    ];

    render(<Dashboard csvData={mockData} />);

    // Should format with commas — amount appears in both Total Debits and Net Spending
    expect(screen.getAllByText(/₹1,23,456\.78/).length).toBeGreaterThanOrEqual(1);
  });

  it('should render dashboard sections correctly', () => {
    const mockData = [
      { Date: new Date('2025-01-15'), Amount: 100, IsCredit: false, Type: 'Debit', Description: 'Test' }
    ];

    render(<Dashboard csvData={mockData} />);

    expect(screen.getByText(/Statement Analysis/i)).toBeInTheDocument();
    expect(screen.getByText(/Total Debits/i)).toBeInTheDocument();
    expect(screen.getByText(/Total Credits/i)).toBeInTheDocument();
    expect(screen.getByText(/Net Spending/i)).toBeInTheDocument();
    expect(screen.getByText(/Monthly Spending/i)).toBeInTheDocument();
  });

  it('should handle data with only credits (no debits)', () => {
    const mockData = [
      { Date: new Date('2025-01-15'), Amount: 100, IsCredit: true, Type: 'Credit', Description: 'Credit1' },
      { Date: new Date('2025-01-20'), Amount: 200, IsCredit: true, Type: 'Credit', Description: 'Credit2' }
    ];

    render(<Dashboard csvData={mockData} />);

    expect(screen.getByText(/₹0\.00/)).toBeInTheDocument(); // Debits should be 0
    expect(screen.getByText(/₹300\.00/)).toBeInTheDocument(); // Credits should be 300
  });

  it('should show only debit amounts in chart dataset', () => {
    const mockData = [
      { Date: new Date('2025-01-15'), Amount: 500, IsCredit: false, Type: 'Debit', Description: 'Debit' },
      { Date: new Date('2025-01-20'), Amount: 100, IsCredit: true, Type: 'Credit', Description: 'Credit' }
    ];

    render(<Dashboard csvData={mockData} />);

    const chartDatasets = screen.getByTestId('chart-datasets');
    const datasets = JSON.parse(chartDatasets.textContent);

    // Single dataset should show only debits (500 for Jan)
    expect(datasets[0].data[0]).toBe(500);
  });
});

describe('CC Payment Filtering', () => {
  it('should exclude CC PAYMENT credits from totals', () => {
    const mockData = [
      { Date: new Date('2025-01-01'), Amount: 500, IsCredit: false, Type: 'Debit', Description: 'Store Purchase' },
      { Date: new Date('2025-01-05'), Amount: 50000, IsCredit: true, Type: 'Credit', Description: 'CC PAYMENT 00000 0 TestApp (Ref# 000000)' }
    ];

    render(<Dashboard csvData={mockData} />);

    // CC payment credit should be excluded, so total credits = 0
    expect(screen.getByText(/₹0\.00/)).toBeInTheDocument();
    // Debits = 500, Net = 500 (same value appears twice)
    expect(screen.getAllByText(/₹500\.00/).length).toBeGreaterThanOrEqual(1);
  });

  it('should exclude BPPY credits from totals', () => {
    const mockData = [
      { Date: new Date('2025-01-01'), Amount: 300, IsCredit: false, Type: 'Debit', Description: 'Store Purchase' },
      { Date: new Date('2025-01-05'), Amount: 10000, IsCredit: true, Type: 'Credit', Description: 'BPPY Payment Ref 12345' }
    ];

    render(<Dashboard csvData={mockData} />);

    // BPPY credit should be excluded, so total credits = 0
    expect(screen.getByText(/₹0\.00/)).toBeInTheDocument();
    // Debits = 300, Net = 300 (same value appears twice)
    expect(screen.getAllByText(/₹300\.00/).length).toBeGreaterThanOrEqual(1);
  });

  it('should include non-CC credits in totals', () => {
    const mockData = [
      { Date: new Date('2025-01-01'), Amount: 500, IsCredit: false, Type: 'Debit', Description: 'Store Purchase' },
      { Date: new Date('2025-01-05'), Amount: 200, IsCredit: true, Type: 'Credit', Description: 'Refund from Store' }
    ];

    render(<Dashboard csvData={mockData} />);

    // Normal credit should be included
    expect(screen.getByText(/₹200\.00/)).toBeInTheDocument();
  });

  it('should still include CC payment debits in totals', () => {
    const mockData = [
      { Date: new Date('2025-01-01'), Amount: 500, IsCredit: false, Type: 'Debit', Description: 'CC PAYMENT REVERSAL' },
      { Date: new Date('2025-01-05'), Amount: 200, IsCredit: false, Type: 'Debit', Description: 'Store Purchase' }
    ];

    render(<Dashboard csvData={mockData} />);

    // Both debits should be included (filter only excludes CC credits)
    // Debits = 700, Net = 700 (same value appears twice)
    expect(screen.getAllByText(/₹700\.00/).length).toBeGreaterThanOrEqual(1);
  });

  it('should handle null description without crashing', () => {
    const mockData = [
      { Date: new Date('2025-01-01'), Amount: 100, IsCredit: true, Type: 'Credit', Description: null },
      { Date: new Date('2025-01-02'), Amount: 200, IsCredit: false, Type: 'Debit', Description: 'Store' }
    ];

    render(<Dashboard csvData={mockData} />);

    // Should not crash, null description credit should be included (not a CC payment)
    // ₹100.00 appears twice (credits and net spending)
    expect(screen.getAllByText(/₹100\.00/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/₹200\.00/)).toBeInTheDocument();
  });
});

describe('Range Selector', () => {
  it('should render all range buttons', () => {
    const mockData = [
      { Date: new Date('2025-01-15'), Amount: 100, IsCredit: false, Type: 'Debit', Description: 'Test' }
    ];

    render(<Dashboard csvData={mockData} />);

    expect(screen.getByText('1M')).toBeInTheDocument();
    expect(screen.getByText('3M')).toBeInTheDocument();
    expect(screen.getByText('6M')).toBeInTheDocument();
    expect(screen.getByText('12M')).toBeInTheDocument();
    expect(screen.getByText('All')).toBeInTheDocument();
  });

  it('should have "1M" as default active range', () => {
    const mockData = [
      { Date: new Date('2025-01-15'), Amount: 100, IsCredit: false, Type: 'Debit', Description: 'Test' }
    ];

    render(<Dashboard csvData={mockData} />);

    const btn1M = screen.getByText('1M');
    expect(btn1M.className).toContain('active');
  });

  it('should filter data when clicking a range button', () => {
    const mockData = [
      { Date: new Date('2025-01-15'), Amount: 100, IsCredit: false, Type: 'Debit', Description: 'Old' },
      { Date: new Date('2025-06-15'), Amount: 200, IsCredit: false, Type: 'Debit', Description: 'Mid' },
      { Date: new Date('2025-12-15'), Amount: 400, IsCredit: false, Type: 'Debit', Description: 'Recent' }
    ];

    render(<Dashboard csvData={mockData} />);

    // Default is "1M" — only "Recent" (Dec) should show — debits = 400
    expect(screen.getAllByText(/₹400\.00/).length).toBeGreaterThanOrEqual(1);

    // Click "All" — should show all transactions — total debits = 700
    fireEvent.click(screen.getByText('All'));

    expect(screen.getAllByText(/₹700\.00/).length).toBeGreaterThanOrEqual(1);
  });

  it('should update active button class on click', () => {
    const mockData = [
      { Date: new Date('2025-01-15'), Amount: 100, IsCredit: false, Type: 'Debit', Description: 'Test' }
    ];

    render(<Dashboard csvData={mockData} />);

    const btn6M = screen.getByText('6M');
    fireEvent.click(btn6M);

    expect(btn6M.className).toContain('active');
    expect(screen.getByText('All').className).not.toContain('active');
  });
});

describe('Dashboard with showCredits=false', () => {
  beforeEach(() => {
    mockShowCredits = false;
  });

  it('should hide Total Credits and Net Spending cards', () => {
    const mockData = [
      { Date: new Date('2025-01-01'), Amount: 500, IsCredit: false, Type: 'Debit', Description: 'Store' },
      { Date: new Date('2025-01-05'), Amount: 200, IsCredit: true, Type: 'Credit', Description: 'Refund' },
    ];

    render(<Dashboard csvData={mockData} />);

    expect(screen.getByText(/Total Debits/i)).toBeInTheDocument();
    expect(screen.queryByText(/Total Credits/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Net Spending/i)).not.toBeInTheDocument();
  });

  it('should still show Total Debits card', () => {
    const mockData = [
      { Date: new Date('2025-01-01'), Amount: 300, IsCredit: false, Type: 'Debit', Description: 'Store' },
    ];

    render(<Dashboard csvData={mockData} />);

    expect(screen.getByText(/Total Debits/i)).toBeInTheDocument();
    expect(screen.getByText(/₹300\.00/)).toBeInTheDocument();
  });
});
