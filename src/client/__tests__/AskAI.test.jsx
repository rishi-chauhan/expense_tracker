/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import AskAI from '../components/AskAI';

// Mock fetch globally
let fetchMock;

function renderAskAI(props = {}) {
  const defaultProps = { isOpen: true, onClose: vi.fn() };
  return render(
    <MemoryRouter>
      <AskAI {...defaultProps} {...props} />
    </MemoryRouter>
  );
}

describe('AskAI', () => {
  beforeEach(() => {
    fetchMock = vi.fn();
    global.fetch = fetchMock;
  });

  it('should render nothing when isOpen is false', () => {
    fetchMock.mockResolvedValue({ json: async () => ({ available: true }) });
    const { container } = renderAskAI({ isOpen: false });
    expect(container.innerHTML).toBe('');
  });

  it('should render the chat panel when isOpen is true', () => {
    fetchMock.mockResolvedValue({ json: async () => ({ available: true }) });
    renderAskAI();
    expect(screen.getByText('Ask AI')).toBeTruthy();
    expect(screen.getByPlaceholderText('Ask about your expenses...')).toBeTruthy();
  });

  it('should check Ollama health on first open', async () => {
    fetchMock.mockResolvedValue({ json: async () => ({ available: true }) });
    renderAskAI();

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/chat/health');
    });
  });

  it('should show unavailable message when Ollama is down', async () => {
    fetchMock.mockResolvedValue({ json: async () => ({ available: false }) });
    renderAskAI();

    await waitFor(() => {
      expect(screen.getByText(/AI assistant is not available/)).toBeTruthy();
    });
  });

  it('should show suggestion chips when no messages', async () => {
    fetchMock.mockResolvedValue({ json: async () => ({ available: true }) });
    renderAskAI();

    await waitFor(() => {
      expect(screen.getByText('How much did I spend last month?')).toBeTruthy();
      expect(screen.getByText('Top 5 merchants by spending')).toBeTruthy();
    });
  });

  it('should disable input when Ollama is unavailable', async () => {
    fetchMock.mockResolvedValue({ json: async () => ({ available: false }) });
    renderAskAI();

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Ask about your expenses...').disabled).toBe(true);
    });
  });

  it('should submit a question and display the answer', async () => {
    const user = userEvent.setup();
    fetchMock
      .mockResolvedValueOnce({ json: async () => ({ available: true }) })
      .mockResolvedValueOnce({
        json: async () => ({
          success: true,
          answer: 'You spent ₹5,000 last month.',
          sql: 'SELECT SUM(amount) FROM transactions',
          rowCount: 1,
        }),
      });

    renderAskAI();

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/chat/health');
    });

    const input = screen.getByPlaceholderText('Ask about your expenses...');
    await user.type(input, 'How much did I spend?');
    await user.keyboard('{Enter}');

    await waitFor(() => {
      expect(screen.getByText('How much did I spend?')).toBeTruthy();
      expect(screen.getByText('You spent ₹5,000 last month.')).toBeTruthy();
    });
  });

  it('should show error message on API failure', async () => {
    const user = userEvent.setup();
    fetchMock
      .mockResolvedValueOnce({ json: async () => ({ available: true }) })
      .mockResolvedValueOnce({
        json: async () => ({
          success: false,
          error: 'Could not generate query. Is Ollama running?',
        }),
      });

    renderAskAI();

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/chat/health');
    });

    const input = screen.getByPlaceholderText('Ask about your expenses...');
    await user.type(input, 'test question');
    await user.keyboard('{Enter}');

    await waitFor(() => {
      expect(screen.getByText(/Could not generate query/)).toBeTruthy();
    });
  });

  it('should show SQL in collapsible details', async () => {
    const user = userEvent.setup();
    fetchMock
      .mockResolvedValueOnce({ json: async () => ({ available: true }) })
      .mockResolvedValueOnce({
        json: async () => ({
          success: true,
          answer: 'Result here',
          sql: 'SELECT * FROM transactions',
          rowCount: 5,
        }),
      });

    renderAskAI();

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/chat/health');
    });

    const input = screen.getByPlaceholderText('Ask about your expenses...');
    await user.type(input, 'show me something');
    await user.keyboard('{Enter}');

    await waitFor(() => {
      expect(screen.getByText('SQL query (5 rows)')).toBeTruthy();
      expect(screen.getByText('SELECT * FROM transactions')).toBeTruthy();
    });
  });

  it('should call onClose when close button is clicked', async () => {
    const onClose = vi.fn();
    fetchMock.mockResolvedValue({ json: async () => ({ available: true }) });
    renderAskAI({ onClose });

    const closeBtn = screen.getByLabelText('Close AI chat');
    await userEvent.click(closeBtn);

    expect(onClose).toHaveBeenCalled();
  });

  it('should close on Escape key', async () => {
    const onClose = vi.fn();
    fetchMock.mockResolvedValue({ json: async () => ({ available: true }) });
    renderAskAI({ onClose });

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('should submit suggestion chip on click', async () => {
    fetchMock
      .mockResolvedValueOnce({ json: async () => ({ available: true }) })
      .mockResolvedValueOnce({
        json: async () => ({
          success: true,
          answer: 'You spent a lot!',
          sql: 'SELECT SUM(amount) FROM transactions',
          rowCount: 1,
        }),
      });

    renderAskAI();

    await waitFor(() => {
      expect(screen.getByText('How much did I spend last month?')).toBeTruthy();
    });

    await userEvent.click(screen.getByText('How much did I spend last month?'));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/chat', expect.objectContaining({
        method: 'POST',
      }));
    });
  });

  it('should handle network errors gracefully', async () => {
    const user = userEvent.setup();
    fetchMock
      .mockResolvedValueOnce({ json: async () => ({ available: true }) })
      .mockRejectedValueOnce(new Error('Network error'));

    renderAskAI();

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/chat/health');
    });

    const input = screen.getByPlaceholderText('Ask about your expenses...');
    await user.type(input, 'test');
    await user.keyboard('{Enter}');

    await waitFor(() => {
      expect(screen.getByText('Could not reach the server')).toBeTruthy();
    });
  });
});
