/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import App from '../App';

describe('App Component', () => {
  let fetchMock;

  beforeEach(() => {
    // Setup fetch mock
    fetchMock = vi.fn();
    global.fetch = fetchMock;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should render app header', () => {
    fetchMock.mockResolvedValue({
      json: async () => ({ success: true, transactions: [] })
    });

    render(<App />);

    expect(screen.getByText('Expense Tracker')).toBeInTheDocument();
    expect(screen.getByText(/Analyze your credit card spending patterns/i)).toBeInTheDocument();
  });

  it('should load transactions on mount', async () => {
    fetchMock.mockResolvedValueOnce({
      json: async () => ({
        success: true,
        transactions: [
          {
            date: '2025-01-15',
            amount: 100,
            description: 'Test Store',
            is_credit: 0,
            type: 'Debit'
          }
        ]
      })
    });

    render(<App />);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/transactions');
    });
  });

  it('should not show error when initial load fails', async () => {
    fetchMock.mockRejectedValueOnce(new Error('Network error'));

    render(<App />);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled();
    });

    // Should not show error UI
    expect(screen.queryByText(/Upload Failed/i)).not.toBeInTheDocument();
  });

  it('should handle empty transactions array', async () => {
    fetchMock.mockResolvedValueOnce({
      json: async () => ({ success: true, transactions: [] })
    });

    render(<App />);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled();
    });

    // Dashboard should not be shown for empty data
    expect(screen.queryByText(/Upload a CSV file/i)).toBeInTheDocument();
  });

  it('should transform API data correctly', async () => {
    fetchMock.mockResolvedValueOnce({
      json: async () => ({
        success: true,
        transactions: [
          {
            date: '2025-01-15',
            amount: 100.50,
            description: 'Test Store',
            is_credit: 0,
            type: 'Debit'
          }
        ]
      })
    });

    render(<App />);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled();
    });

    // Should render dashboard with transformed data
    await waitFor(() => {
      expect(screen.getByText(/Credit Card Statement Analysis/i)).toBeInTheDocument();
    });
  });

  it('should render file upload component', () => {
    fetchMock.mockResolvedValue({
      json: async () => ({ success: true, transactions: [] })
    });

    render(<App />);

    expect(screen.getByText(/Upload Credit Card Statement/i)).toBeInTheDocument();
  });
});
