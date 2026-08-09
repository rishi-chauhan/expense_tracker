/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import StatementsPage from '../pages/StatementsPage';

function jsonResponse(data) {
  return {
    ok: true,
    status: 200,
    headers: { get: () => 'application/json' },
    json: async () => data,
  };
}

describe('StatementsPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('lists statements and deletes one', async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({
        success: true,
        statements: [{
          id: 1,
          file_name: 'jan.csv',
          card_label: 'HDFC ...1234',
          period_start: '2025-01-01',
          period_end: '2025-01-31',
          transaction_count: 10,
          uploaded_at: '2025-02-01T00:00:00Z',
        }],
      }))
      .mockResolvedValueOnce(jsonResponse({ success: true, deletedCount: 1 }))
      .mockResolvedValueOnce(jsonResponse({ success: true, statements: [] }));

    global.fetch = fetchMock;
    window.confirm = vi.fn(() => true);

    const onChanged = vi.fn();
    render(
      <MemoryRouter>
        <StatementsPage onChanged={onChanged} />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('jan.csv')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/statements/1', expect.objectContaining({ method: 'DELETE' }));
      expect(onChanged).toHaveBeenCalled();
    });
  });
});
