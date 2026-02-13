/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import HomePage from '../pages/HomePage';

vi.mock('react-chartjs-2', () => ({
  Line: ({ data }) => (
    <div data-testid="line-chart">
      <div data-testid="chart-labels">{JSON.stringify(data.labels)}</div>
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

describe('HomePage', () => {
  const defaultProps = {
    csvData: null,
    loading: false,
    error: null,
    notification: null,
    onFileUpload: vi.fn(),
    onErrorDismiss: vi.fn(),
    onNotificationDismiss: vi.fn(),
    onError: vi.fn(),
  };

  it('renders FileUpload and Dashboard', () => {
    render(<HomePage {...defaultProps} />);

    expect(screen.getByText('Upload Credit Card Statement')).toBeInTheDocument();
    // Dashboard should show empty state
    expect(screen.getByText(/Upload a CSV file/i)).toBeInTheDocument();
  });

  it('shows loading state', () => {
    render(<HomePage {...defaultProps} loading={true} />);

    expect(screen.getByText('Uploading statement...')).toBeInTheDocument();
    const spinner = document.querySelector('.loading-spinner');
    expect(spinner).toBeInTheDocument();
  });

  it('shows error state with message', () => {
    render(<HomePage {...defaultProps} error="Invalid CSV format" />);

    expect(screen.getByText('Upload Failed')).toBeInTheDocument();
    expect(screen.getByText('Invalid CSV format')).toBeInTheDocument();
  });

  it('calls onErrorDismiss when error close button is clicked', () => {
    const onErrorDismiss = vi.fn();
    render(<HomePage {...defaultProps} error="Some error" onErrorDismiss={onErrorDismiss} />);

    fireEvent.click(screen.getByLabelText('Close error'));
    expect(onErrorDismiss).toHaveBeenCalledTimes(1);
  });

  it('renders notification with correct type and dismiss works', () => {
    const onNotificationDismiss = vi.fn();
    const notification = {
      type: 'success',
      title: 'Upload Complete!',
      message: 'Processed 10 transactions',
    };

    render(
      <HomePage
        {...defaultProps}
        notification={notification}
        onNotificationDismiss={onNotificationDismiss}
      />
    );

    expect(screen.getByText('Upload Complete!')).toBeInTheDocument();
    expect(screen.getByText('Processed 10 transactions')).toBeInTheDocument();

    // Check type class
    const container = screen.getByText('Upload Complete!').closest('.notification-container');
    expect(container).toHaveClass('success');

    // Dismiss
    fireEvent.click(screen.getByLabelText('Close notification'));
    expect(onNotificationDismiss).toHaveBeenCalledTimes(1);
  });
});
