/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import Dashboard from '../components/Dashboard';

// Mock Chart.js components
vi.mock('react-chartjs-2', () => ({
  Bar: ({ data, options }) => (
    <div data-testid="bar-chart">
      <div data-testid="chart-labels">{JSON.stringify(data.labels)}</div>
      <div data-testid="chart-datasets">{JSON.stringify(data.datasets)}</div>
    </div>
  )
}));

vi.mock('chart.js', () => ({
  Chart: class Chart {},
  CategoryScale: class CategoryScale {},
  LinearScale: class LinearScale {},
  BarElement: class BarElement {},
  Title: class Title {},
  Tooltip: class Tooltip {},
  Legend: class Legend {}
}));

describe('Dashboard Component', () => {
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

    // Should show 3 months
    expect(screen.getByText(/3 months/i)).toBeInTheDocument();
  });

  it('should render bar chart with correct labels', () => {
    const mockData = [
      { Date: new Date('2025-01-15'), Amount: 100, IsCredit: false, Type: 'Debit', Description: 'Test' },
      { Date: new Date('2025-02-10'), Amount: 200, IsCredit: false, Type: 'Debit', Description: 'Test' }
    ];

    render(<Dashboard csvData={mockData} />);

    const chartLabels = screen.getByTestId('chart-labels');
    const labelsData = JSON.parse(chartLabels.textContent);

    expect(labelsData).toContain('Jan 2025');
    expect(labelsData).toContain('Feb 2025');
  });

  it('should separate debits and credits in monthly data', () => {
    const mockData = [
      { Date: new Date('2025-01-15'), Amount: 300, IsCredit: false, Type: 'Debit', Description: 'Debit1' },
      { Date: new Date('2025-01-20'), Amount: 100, IsCredit: true, Type: 'Credit', Description: 'Credit1' }
    ];

    render(<Dashboard csvData={mockData} />);

    const chartDatasets = screen.getByTestId('chart-datasets');
    const datasets = JSON.parse(chartDatasets.textContent);

    expect(datasets).toHaveLength(2);
    expect(datasets[0].label).toContain('Debits');
    expect(datasets[1].label).toContain('Credits');
  });

  it('should handle invalid dates gracefully', () => {
    const mockData = [
      { Date: new Date('2025-01-15'), Amount: 100, IsCredit: false, Type: 'Debit', Description: 'Valid' },
      { Date: new Date('invalid'), Amount: 200, IsCredit: false, Type: 'Debit', Description: 'Invalid' },
      { Date: null, Amount: 300, IsCredit: false, Type: 'Debit', Description: 'Null' }
    ];

    render(<Dashboard csvData={mockData} />);

    // Should only process valid date (100)
    expect(screen.getByText(/₹100\.00/)).toBeInTheDocument();
  });

  it('should handle missing amount fields gracefully', () => {
    const mockData = [
      { Date: new Date('2025-01-15'), Amount: 100, IsCredit: false, Type: 'Debit', Description: 'Valid' },
      { Date: new Date('2025-01-16'), Amount: null, IsCredit: false, Type: 'Debit', Description: 'NoAmount' },
      { Date: new Date('2025-01-17'), IsCredit: false, Type: 'Debit', Description: 'MissingAmount' }
    ];

    render(<Dashboard csvData={mockData} />);

    // Should only process valid amount (100)
    expect(screen.getByText(/₹100\.00/)).toBeInTheDocument();
  });

  it('should sort months chronologically', () => {
    const mockData = [
      { Date: new Date('2025-03-15'), Amount: 100, IsCredit: false, Type: 'Debit', Description: 'Mar' },
      { Date: new Date('2025-01-10'), Amount: 200, IsCredit: false, Type: 'Debit', Description: 'Jan' },
      { Date: new Date('2025-02-20'), Amount: 150, IsCredit: false, Type: 'Debit', Description: 'Feb' }
    ];

    render(<Dashboard csvData={mockData} />);

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

    // Should show debits but credits should be 0.00
    expect(screen.getByText(/₹100\.00/)).toBeInTheDocument();
    expect(screen.getByText(/₹0\.00/)).toBeInTheDocument();
  });

  it('should format amounts with Indian locale', () => {
    const mockData = [
      { Date: new Date('2025-01-15'), Amount: 123456.78, IsCredit: false, Type: 'Debit', Description: 'Test' }
    ];

    render(<Dashboard csvData={mockData} />);

    // Should format with commas according to Indian locale
    expect(screen.getByText(/₹1,23,456\.78/)).toBeInTheDocument();
  });

  it('should render dashboard sections correctly', () => {
    const mockData = [
      { Date: new Date('2025-01-15'), Amount: 100, IsCredit: false, Type: 'Debit', Description: 'Test' }
    ];

    render(<Dashboard csvData={mockData} />);

    expect(screen.getByText(/Credit Card Statement Analysis/i)).toBeInTheDocument();
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

  it('should calculate monthly debits and credits separately', () => {
    const mockData = [
      { Date: new Date('2025-01-15'), Amount: 500, IsCredit: false, Type: 'Debit', Description: 'Debit' },
      { Date: new Date('2025-01-20'), Amount: 100, IsCredit: true, Type: 'Credit', Description: 'Credit' }
    ];

    render(<Dashboard csvData={mockData} />);

    const chartDatasets = screen.getByTestId('chart-datasets');
    const datasets = JSON.parse(chartDatasets.textContent);

    // First dataset (debits) should have 500 for Jan
    expect(datasets[0].data[0]).toBe(500);

    // Second dataset (credits) should have 100 for Jan
    expect(datasets[1].data[0]).toBe(100);
  });
});
