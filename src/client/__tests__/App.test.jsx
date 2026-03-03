/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import App from '../App';

vi.mock('../contexts/SettingsContext', () => ({
  useSettings: () => ({ showCredits: true, toggleShowCredits: () => {} }),
}));

// Helper: create a URL-aware fetch mock with optional per-endpoint overrides
function makeFetchMock(overrides = {}) {
  const defaults = {
    '/api/transactions': { success: true, transactions: [] },
    '/api/cards': { success: true, cards: [] },
  };
  return vi.fn((url) => {
    const endpoint = typeof url === 'string' ? url.replace(/\?.*$/, '') : url;
    const data = overrides[endpoint] || defaults[endpoint] || { success: true };
    return Promise.resolve({ json: async () => data });
  });
}

function renderApp(initialRoute = '/') {
  return render(
    <MemoryRouter initialEntries={[initialRoute]}>
      <App />
    </MemoryRouter>
  );
}

describe('App Component', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should render app header', () => {
    global.fetch = makeFetchMock();
    renderApp();
    expect(screen.getByText('Paisa Kidhar Gaya?!')).toBeInTheDocument();
  });

  it('should render navigation links', () => {
    global.fetch = makeFetchMock();
    renderApp();
    expect(screen.getByText('Home')).toBeInTheDocument();
    expect(screen.getByText('Analytics')).toBeInTheDocument();
  });

  it('should load transactions on mount', async () => {
    const fetchMock = makeFetchMock({
      '/api/transactions': {
        success: true,
        transactions: [
          { date: '2025-01-15', amount: 100, description: 'Test Store', is_credit: 0, type: 'Debit' }
        ]
      }
    });
    global.fetch = fetchMock;
    renderApp();

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/transactions');
    });
  });

  it('should not show error when initial load fails', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));
    renderApp();

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled();
    });

    expect(screen.queryByText(/Upload Failed/i)).not.toBeInTheDocument();
  });

  it('should handle empty transactions array', async () => {
    global.fetch = makeFetchMock();
    renderApp();

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled();
    });

    expect(screen.queryByText(/Upload a CSV file/i)).toBeInTheDocument();
  });

  it('should transform API data correctly', async () => {
    global.fetch = makeFetchMock({
      '/api/transactions': {
        success: true,
        transactions: [
          { date: '2025-01-15', amount: 100.50, description: 'Test Store', is_credit: 0, type: 'Debit' }
        ]
      }
    });
    renderApp();

    await waitFor(() => {
      expect(screen.getByText(/Credit Card Statement Analysis/i)).toBeInTheDocument();
    });
  });

  it('should render file upload component', () => {
    global.fetch = makeFetchMock();
    renderApp();
    expect(screen.getByLabelText(/Upload Credit Card Statement/i)).toBeInTheDocument();
  });

  it('should navigate to analytics page', async () => {
    global.fetch = makeFetchMock();
    renderApp();

    const analyticsLink = screen.getByText('Analytics');
    await userEvent.click(analyticsLink);

    expect(screen.getByText('No Data Yet')).toBeInTheDocument();
  });

  it('should show analytics with data', async () => {
    global.fetch = makeFetchMock({
      '/api/transactions': {
        success: true,
        transactions: [
          { date: '2025-01-15', amount: 100, description: 'Test Store', is_credit: 0, type: 'Debit' }
        ]
      }
    });

    renderApp('/analytics');

    await waitFor(() => {
      expect(screen.getByText('Analytics Dashboard')).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('should display error when upload fails', async () => {
      // Initial load uses URL-aware mock; upload uses sequential override
      const fetchMock = makeFetchMock();
      global.fetch = fetchMock;

      const { container } = renderApp();

      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalledWith('/api/transactions');
      });

      // Override for upload call
      fetchMock.mockResolvedValueOnce({
        json: async () => ({
          success: false,
          error: 'Could not find header row with DATE and AMT columns'
        })
      });

      const file = new File(['invalid content'], 'test.csv', { type: 'text/csv' });
      const input = container.querySelector('input[type="file"]');
      await userEvent.upload(input, file);

      await waitFor(() => {
        expect(screen.getByText('Upload Failed')).toBeInTheDocument();
        expect(screen.getByText(/Could not find header row with DATE and AMT columns/i)).toBeInTheDocument();
      });

      const errorContainer = screen.getByText('Upload Failed').closest('.error-container');
      expect(errorContainer).toBeInTheDocument();
      expect(errorContainer.querySelector('.error-icon')).toHaveTextContent('!');
    });

    it('should show error close button', async () => {
      const fetchMock = makeFetchMock();
      global.fetch = fetchMock;

      const { container } = renderApp();

      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalled();
      });

      fetchMock.mockResolvedValueOnce({
        json: async () => ({
          success: false,
          error: 'Upload failed: Invalid format'
        })
      });

      const file = new File(['test'], 'test.csv', { type: 'text/csv' });
      const input = container.querySelector('input[type="file"]');
      await userEvent.upload(input, file);

      await waitFor(() => {
        expect(screen.getByText('Upload Failed')).toBeInTheDocument();
      });

      const closeButton = screen.getByLabelText('Close error');
      expect(closeButton).toBeInTheDocument();
      expect(closeButton).toHaveClass('error-close');
      expect(closeButton).toHaveTextContent('×');
    });

    it('should dismiss error when close button is clicked', async () => {
      const fetchMock = makeFetchMock();
      global.fetch = fetchMock;

      const { container } = renderApp();

      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalled();
      });

      fetchMock.mockResolvedValueOnce({
        json: async () => ({
          success: false,
          error: 'Upload failed: Test error message'
        })
      });

      const file = new File(['test'], 'test.csv', { type: 'text/csv' });
      const input = container.querySelector('input[type="file"]');
      await userEvent.upload(input, file);

      await waitFor(() => {
        expect(screen.getByText('Upload Failed')).toBeInTheDocument();
      });

      const closeButton = screen.getByLabelText('Close error');
      await userEvent.click(closeButton);

      await waitFor(() => {
        expect(screen.queryByText('Upload Failed')).not.toBeInTheDocument();
        expect(screen.queryByText(/Test error message/i)).not.toBeInTheDocument();
      });
    });

    it('should handle network errors during upload', async () => {
      const fetchMock = makeFetchMock();
      global.fetch = fetchMock;

      const { container } = renderApp();

      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalled();
      });

      fetchMock.mockRejectedValueOnce(new Error('Network connection failed'));

      const file = new File(['test'], 'test.csv', { type: 'text/csv' });
      const input = container.querySelector('input[type="file"]');
      await userEvent.upload(input, file);

      await waitFor(() => {
        expect(screen.getByText('Upload Failed')).toBeInTheDocument();
        expect(screen.getByText(/Upload failed: Network connection failed/i)).toBeInTheDocument();
      });
    });
  });

  describe('Notification Handling', () => {
    it('should display success notification after successful upload', async () => {
      const fetchMock = makeFetchMock();
      global.fetch = fetchMock;

      const { container } = renderApp();

      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalled();
      });

      // Upload succeeds, then fetchData re-fetches both endpoints
      fetchMock
        .mockResolvedValueOnce({
          json: async () => ({
            success: true,
            isDuplicate: false,
            newCount: 10,
            duplicateCount: 0,
            statementInfo: {
              fileName: 'statement.csv',
              periodStart: '2025-01-01',
              periodEnd: '2025-01-31'
            },
            cardInfo: { bankName: 'HDFC', cardLast4: '1234', cardId: 1 }
          })
        })
        .mockResolvedValueOnce({
          json: async () => ({ success: true, transactions: [] })
        })
        .mockResolvedValueOnce({
          json: async () => ({ success: true, cards: [] })
        });

      const file = new File(['test'], 'statement.csv', { type: 'text/csv' });
      const input = container.querySelector('input[type="file"]');
      await userEvent.upload(input, file);

      await waitFor(() => {
        expect(screen.getByText('Upload Complete!')).toBeInTheDocument();
        expect(screen.getByText(/Successfully processed statement.csv/i)).toBeInTheDocument();
      });

      const notification = screen.getByText('Upload Complete!').closest('.notification-container');
      expect(notification).toHaveClass('success');
      expect(notification.querySelector('.notification-icon')).toHaveTextContent('✓');
    });

    it('should display info notification for duplicate statement', async () => {
      const fetchMock = makeFetchMock();
      global.fetch = fetchMock;

      const { container } = renderApp();

      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalled();
      });

      fetchMock.mockResolvedValueOnce({
        json: async () => ({
          success: true,
          isDuplicate: true,
          existingStatement: {
            file_name: 'old_statement.csv',
            uploaded_at: '2025-01-15T10:30:00Z',
            period_start: '2025-01-01',
            period_end: '2025-01-31'
          }
        })
      });

      const file = new File(['test'], 'statement.csv', { type: 'text/csv' });
      const input = container.querySelector('input[type="file"]');
      await userEvent.upload(input, file);

      await waitFor(() => {
        expect(screen.getByText('Duplicate Statement')).toBeInTheDocument();
      });

      const notification = screen.getByText('Duplicate Statement').closest('.notification-container');
      expect(notification).toHaveClass('info');
      expect(notification.querySelector('.notification-icon')).toHaveTextContent('ⓘ');
    });

    it('should show notification close button', async () => {
      const fetchMock = makeFetchMock();
      global.fetch = fetchMock;

      const { container } = renderApp();

      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalled();
      });

      fetchMock
        .mockResolvedValueOnce({
          json: async () => ({
            success: true,
            isDuplicate: false,
            newCount: 5,
            duplicateCount: 0,
            statementInfo: {
              fileName: 'test.csv',
              periodStart: '2025-01-01',
              periodEnd: '2025-01-31'
            },
            cardInfo: { bankName: 'HDFC', cardLast4: '1234', cardId: 1 }
          })
        })
        .mockResolvedValueOnce({
          json: async () => ({ success: true, transactions: [] })
        })
        .mockResolvedValueOnce({
          json: async () => ({ success: true, cards: [] })
        });

      const file = new File(['test'], 'test.csv', { type: 'text/csv' });
      const input = container.querySelector('input[type="file"]');
      await userEvent.upload(input, file);

      await waitFor(() => {
        expect(screen.getByText('Upload Complete!')).toBeInTheDocument();
      });

      const closeButton = screen.getByLabelText('Close notification');
      expect(closeButton).toBeInTheDocument();
      expect(closeButton).toHaveClass('notification-close');
      expect(closeButton).toHaveTextContent('×');
    });

    it('should dismiss notification when close button is clicked', async () => {
      const fetchMock = makeFetchMock();
      global.fetch = fetchMock;

      const { container } = renderApp();

      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalled();
      });

      fetchMock
        .mockResolvedValueOnce({
          json: async () => ({
            success: true,
            isDuplicate: false,
            newCount: 5,
            duplicateCount: 0,
            statementInfo: {
              fileName: 'test.csv',
              periodStart: '2025-01-01',
              periodEnd: '2025-01-31'
            },
            cardInfo: { bankName: 'HDFC', cardLast4: '1234', cardId: 1 }
          })
        })
        .mockResolvedValueOnce({
          json: async () => ({ success: true, transactions: [] })
        })
        .mockResolvedValueOnce({
          json: async () => ({ success: true, cards: [] })
        });

      const file = new File(['test'], 'test.csv', { type: 'text/csv' });
      const input = container.querySelector('input[type="file"]');
      await userEvent.upload(input, file);

      await waitFor(() => {
        expect(screen.getByText('Upload Complete!')).toBeInTheDocument();
      });

      const closeButton = screen.getByLabelText('Close notification');
      await userEvent.click(closeButton);

      await waitFor(() => {
        expect(screen.queryByText('Upload Complete!')).not.toBeInTheDocument();
      });
    });

    it('should clear previous error when new upload starts', async () => {
      const fetchMock = makeFetchMock();
      global.fetch = fetchMock;

      const { container } = renderApp();

      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalled();
      });

      // First upload fails
      fetchMock.mockResolvedValueOnce({
        json: async () => ({
          success: false,
          error: 'First error message'
        })
      });

      const file1 = new File(['test1'], 'test1.csv', { type: 'text/csv' });
      const input = container.querySelector('input[type="file"]');
      await userEvent.upload(input, file1);

      await waitFor(() => {
        expect(screen.getByText(/First error message/i)).toBeInTheDocument();
      });

      // Second upload succeeds
      fetchMock
        .mockResolvedValueOnce({
          json: async () => ({
            success: true,
            isDuplicate: false,
            newCount: 5,
            duplicateCount: 0,
            statementInfo: {
              fileName: 'test2.csv',
              periodStart: '2025-01-01',
              periodEnd: '2025-01-31'
            },
            cardInfo: { bankName: 'HDFC', cardLast4: '1234', cardId: 1 }
          })
        })
        .mockResolvedValueOnce({
          json: async () => ({ success: true, transactions: [] })
        })
        .mockResolvedValueOnce({
          json: async () => ({ success: true, cards: [] })
        });

      const file2 = new File(['test2'], 'test2.csv', { type: 'text/csv' });
      await userEvent.upload(input, file2);

      await waitFor(() => {
        expect(screen.queryByText(/First error message/i)).not.toBeInTheDocument();
        expect(screen.getByText('Upload Complete!')).toBeInTheDocument();
      });
    });
  });
});
