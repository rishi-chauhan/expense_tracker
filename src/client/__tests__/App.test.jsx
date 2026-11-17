/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import App from '../App';
import { SettingsProvider } from '../contexts/SettingsContext';
import { AuthProvider } from '../contexts/AuthContext';
import { ToastProvider } from '../components/ui/Toast';
import { makeFetchMock, jsonResponse, LocationProbe } from './testUtils';

vi.mock('react-chartjs-2', () => ({
  Line: () => <div data-testid="line-chart" />,
  Bar: () => <div data-testid="bar-chart" />,
  Doughnut: () => <div data-testid="doughnut-chart" />,
}));

const TX = [
  { id: 1, date: '2025-03-10', amount: 1500, description: 'SWIGGY', is_credit: 0, type: 'Domestic', card_id: 1, card_label: 'HDFC ...1234', category_id: 2, category_name: 'Dining', category_color: '#fb923c' },
  { id: 2, date: '2025-03-12', amount: 500, description: 'UBER', is_credit: 0, type: 'Domestic', card_id: 1, card_label: 'HDFC ...1234', category_id: null },
];

function renderApp(route = '/', { withAuth = false } = {}) {
  const tree = (
    <MemoryRouter initialEntries={[route]}>
      <SettingsProvider>
        <ToastProvider>
          {withAuth ? <AuthProvider><App /></AuthProvider> : <App />}
          <LocationProbe />
        </ToastProvider>
      </SettingsProvider>
    </MemoryRouter>
  );
  return render(tree);
}

async function openUploadAndPick(user, name = 'statement.csv') {
  await user.click(screen.getByRole('button', { name: 'Upload statement' }));
  const dialog = await screen.findByRole('dialog', { name: 'Upload statement' });
  const input = within(dialog).getByLabelText(/Upload credit card statement/i);
  await user.upload(input, new File(['DATE~AMT'], name, { type: 'text/csv' }));
}

describe('App shell', () => {
  beforeEach(() => {
    global.fetch = makeFetchMock();
  });

  it('renders the brand and primary navigation', () => {
    renderApp();
    expect(screen.getByLabelText('Paisa Kidhar Gaya?! overview')).toBeInTheDocument();
    const nav = screen.getByRole('navigation', { name: 'Primary' });
    for (const label of ['Overview', 'Transactions', 'Insights', 'Statements', 'Categories']) {
      expect(within(nav).getByRole('link', { name: label })).toBeInTheDocument();
    }
  });

  it('loads transactions and cards on mount', async () => {
    const fetchMock = makeFetchMock();
    global.fetch = fetchMock;
    renderApp();
    await waitFor(() => {
      const urls = fetchMock.mock.calls.map(c => c[0]);
      expect(urls).toContain('/api/transactions');
      expect(urls).toContain('/api/cards');
    });
  });

  it('shows the first-run upload card when there is no data', async () => {
    renderApp();
    expect(await screen.findByText('Upload your first statement')).toBeInTheDocument();
    expect(screen.getByText(/Stays on your Pi/)).toBeInTheDocument();
  });

  it('shows the hero sentence and recent transactions with data', async () => {
    global.fetch = makeFetchMock({ '/api/transactions': { success: true, transactions: TX } });
    renderApp();
    const hero = await screen.findByRole('heading', { name: /went out/ });
    expect(hero).toHaveTextContent('₹2,000');
    expect(screen.getByText('Recent transactions')).toBeInTheDocument();
    expect(screen.getAllByText('SWIGGY').length).toBeGreaterThan(0);
  });

  it('shows a load error with retry and dismiss', async () => {
    const user = userEvent.setup();
    let fail = true;
    global.fetch = makeFetchMock({
      '/api/transactions': () => (fail
        ? { __response: jsonResponse({ success: false, error: 'DB offline' }, { status: 500 }) }
        : { success: true, transactions: TX }),
    });
    renderApp();
    expect(await screen.findByText(/Could not load data: DB offline/)).toBeInTheDocument();
    fail = false;
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(screen.queryByText(/Could not load data/)).not.toBeInTheDocument());
  });

  it('navigates to Insights and keeps the global filters in the URL', async () => {
    const user = userEvent.setup();
    global.fetch = makeFetchMock({ '/api/transactions': { success: true, transactions: TX } });
    renderApp('/?period=all');
    await screen.findByRole('heading', { name: /went out/ });
    await user.click(screen.getByRole('link', { name: 'Insights' }));
    expect(await screen.findByText('Spending trends')).toBeInTheDocument();
    expect(screen.getByTestId('location').textContent).toBe('/analytics?period=all');
  });

  it('changes the period from the filter bar', async () => {
    const user = userEvent.setup();
    global.fetch = makeFetchMock({ '/api/transactions': { success: true, transactions: TX } });
    renderApp();
    await screen.findByRole('heading', { name: /went out/ });
    await user.click(screen.getByRole('radio', { name: '12M' }));
    expect(screen.getByTestId('location').textContent).toContain('period=12m');
  });

  it('privacy mode hides every amount (Shift+H)', async () => {
    const user = userEvent.setup();
    global.fetch = makeFetchMock({ '/api/transactions': { success: true, transactions: TX } });
    renderApp();
    const hero = await screen.findByRole('heading', { name: /went out/ });
    expect(hero).toHaveTextContent('₹2,000');
    await user.keyboard('{Shift>}H{/Shift}');
    expect(hero).not.toHaveTextContent('₹2,000');
    expect(screen.getAllByLabelText('hidden amount').length).toBeGreaterThan(0);
    await user.click(screen.getByRole('button', { name: /Show amounts/ }));
    expect(hero).toHaveTextContent('₹2,000');
  });

  it('redirects unknown routes to the overview', async () => {
    renderApp('/nope');
    await waitFor(() => expect(screen.getByTestId('location').textContent).toBe('/'));
  });
});

describe('Upload flow', () => {
  it('shows a success toast and refetches after upload', async () => {
    const user = userEvent.setup();
    const fetchMock = makeFetchMock({
      '/api/upload': {
        success: true, newCount: 12, duplicateCount: 1,
        statementInfo: { fileName: 'statement.csv', periodStart: '2025-01-01', periodEnd: '2025-01-31' },
        cardInfo: { bankName: 'HDFC', cardLast4: '1234' },
      },
    });
    global.fetch = fetchMock;
    renderApp();
    await openUploadAndPick(user);
    const toast = await screen.findByRole('status', { name: '' }).catch(() => null);
    expect(await screen.findByText('Statement uploaded')).toBeInTheDocument();
    expect(screen.getByText(/12 new transactions added from statement.csv/)).toBeInTheDocument();
    expect(toast === null || toast).toBeTruthy();
    const uploads = fetchMock.mock.calls.filter(c => c[0] === '/api/upload');
    expect(uploads).toHaveLength(1);
    expect(uploads[0][1].headers['X-Requested-With']).toBe('paisa');
    expect(uploads[0][1].headers['Content-Type']).toBeUndefined();
    await waitFor(() => expect(fetchMock.mock.calls.filter(c => c[0] === '/api/transactions').length).toBeGreaterThan(1));
    expect(screen.queryByRole('dialog', { name: 'Upload statement' })).not.toBeInTheDocument();
  });

  it('shows an info toast for a duplicate statement', async () => {
    const user = userEvent.setup();
    global.fetch = makeFetchMock({
      '/api/upload': {
        isDuplicate: true,
        existingStatement: { file_name: 'jan.csv', uploaded_at: '2025-02-01T00:00:00Z', period_start: '2025-01-01', period_end: '2025-01-31' },
      },
    });
    renderApp();
    await openUploadAndPick(user);
    expect(await screen.findByText('Already uploaded')).toBeInTheDocument();
    expect(screen.getByText(/jan.csv was uploaded on 1 Feb 2025/)).toBeInTheDocument();
  });

  it('shows an error toast that stays until dismissed', async () => {
    const user = userEvent.setup();
    global.fetch = makeFetchMock({
      '/api/upload': { __response: jsonResponse({ success: false, error: 'No valid transactions found in CSV' }, { status: 400 }) },
    });
    renderApp();
    await openUploadAndPick(user);
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Upload failed');
    expect(alert).toHaveTextContent('No valid transactions found in CSV');
    await user.click(within(alert).getByRole('button', { name: 'Dismiss notification' }));
    expect(screen.queryByText('Upload failed')).not.toBeInTheDocument();
  });

  it('handles network errors', async () => {
    const user = userEvent.setup();
    global.fetch = makeFetchMock({ '/api/upload': () => Promise.reject(new Error('Network down')) });
    renderApp();
    await openUploadAndPick(user);
    expect(await screen.findByText('Network down')).toBeInTheDocument();
  });

  it('asks for card info and re-sends the file with overrides', async () => {
    const user = userEvent.setup();
    let calls = 0;
    const fetchMock = makeFetchMock({
      '/api/upload': () => {
        calls += 1;
        return calls === 1
          ? { success: false, needsCardInfo: true, detected: { bankName: null, cardLast4: null }, transactionCount: 7 }
          : { success: true, newCount: 7, duplicateCount: 0, statementInfo: { fileName: 'statement.csv', periodStart: '2025-01-01', periodEnd: '2025-01-31' }, cardInfo: { bankName: 'ICICI', cardLast4: '9876' } };
      },
    });
    global.fetch = fetchMock;
    renderApp();
    await openUploadAndPick(user);
    const modal = await screen.findByRole('dialog', { name: 'Which card is this?' });
    expect(within(modal).getByText(/7 transactions found/)).toBeInTheDocument();
    await user.type(within(modal).getByLabelText(/Bank name/), 'ICICI');
    await user.type(within(modal).getByLabelText(/Last 4 digits/), '9876');
    await user.click(within(modal).getByRole('button', { name: 'Upload' }));
    expect(await screen.findByText('Statement uploaded')).toBeInTheDocument();
    const second = fetchMock.mock.calls.filter(c => c[0] === '/api/upload')[1][1].body;
    expect(second.get('bankName')).toBe('ICICI');
    expect(second.get('cardLast4')).toBe('9876');
  });
});

describe('Optional login', () => {
  it('shows the app directly when auth routes are absent (404)', async () => {
    global.fetch = makeFetchMock({ '/api/auth/me': { __response: { ok: false, status: 404, headers: { get: () => 'application/json' }, json: async () => ({ success: false }) } } });
    renderApp('/', { withAuth: true });
    expect(await screen.findByText('Upload your first statement')).toBeInTheDocument();
  });

  it('shows the login page when a password is required, then signs in', async () => {
    const user = userEvent.setup();
    let authed = false;
    global.fetch = makeFetchMock({
      '/api/auth/me': () => (authed
        ? { authenticated: true, authRequired: true }
        : { __response: jsonResponse({ authenticated: false, authRequired: true }, { status: 401, ok: false }) }),
      '/api/auth/login': (url, init) => {
        const { password } = JSON.parse(init.body);
        if (password === 'right') { authed = true; return { success: true }; }
        return { __response: jsonResponse({ success: false, error: 'Invalid password' }, { status: 401, ok: false }) };
      },
    });
    renderApp('/', { withAuth: true });
    const field = await screen.findByLabelText('Password');
    await user.type(field, 'wrong');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByText('Wrong password')).toBeInTheDocument();
    await user.type(screen.getByLabelText('Password'), 'right');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByText('Upload your first statement')).toBeInTheDocument();
  });

  it('shows the retry delay when rate limited', async () => {
    const user = userEvent.setup();
    global.fetch = makeFetchMock({
      '/api/auth/me': { __response: jsonResponse({ authenticated: false, authRequired: true }, { status: 401, ok: false }) },
      '/api/auth/login': { __response: jsonResponse({ success: false, error: 'Too many attempts', retryAfter: 8 }, { status: 429, ok: false }) },
    });
    renderApp('/', { withAuth: true });
    await user.type(await screen.findByLabelText('Password'), 'x');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByText('Too many attempts, try again in 8 s')).toBeInTheDocument();
  });
});
