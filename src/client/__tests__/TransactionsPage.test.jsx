/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, fireEvent, within, waitFor } from '@testing-library/react';
import TransactionsPage, { PAGE_SIZE } from '../pages/TransactionsPage';
import { makeTx, makeFetchMock, renderWithProviders, setSettings } from './testUtils';

const categories = [
  { id: 1, name: 'Dining', color: '#fb923c' },
  { id: 2, name: 'Shopping', color: '#a78bfa' },
];

const data = makeTx([
  { id: 1, date: '2025-03-10', amount: 300, description: 'SWIGGY ORDER', categoryId: 1, categoryName: 'Dining' },
  { id: 2, date: '2025-03-12', amount: 1200, description: 'AMAZON', categoryId: 2, categoryName: 'Shopping' },
  { id: 3, date: '2025-03-14', amount: 80, description: 'TEA STALL' },
  { id: 4, date: '2025-03-15', amount: 500, description: 'REFUND AMAZON', credit: true, categoryId: 2, categoryName: 'Shopping' },
]);

function rowsText() {
  return screen.getAllByRole('row').slice(1).map(r => r.textContent);
}

function renderPage({ route = '/transactions?period=all', csvData = data, cards = [] } = {}) {
  const onCategoryChange = vi.fn();
  const utils = renderWithProviders(
    <TransactionsPage cards={cards} onCategoryChange={onCategoryChange} />,
    { route, csvData, cards }
  );
  return { ...utils, onCategoryChange };
}

describe('TransactionsPage (desktop)', () => {
  beforeEach(() => {
    global.fetch = makeFetchMock({ '/api/categories': { success: true, categories, rules: [] } });
  });

  it('lists debits newest first and hides credits by default', () => {
    renderPage();
    const rows = rowsText();
    expect(rows).toHaveLength(3);
    expect(rows[0]).toContain('TEA STALL');
    expect(rows[2]).toContain('SWIGGY ORDER');
    expect(screen.queryByText('REFUND AMAZON')).not.toBeInTheDocument();
    expect(screen.getByText(/transactions/, { selector: '.tx-summary' })).toHaveTextContent('3 transactions');
  });

  it('toggles date sort direction and sorts by amount', () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /^Date/ }));
    expect(rowsText()[0]).toContain('SWIGGY ORDER');
    fireEvent.click(screen.getByRole('button', { name: /^Amount/ }));
    expect(rowsText()[0]).toContain('AMAZON');
    expect(screen.getByRole('columnheader', { name: /Amount/ })).toHaveAttribute('aria-sort', 'descending');
  });

  it('filters by category from the URL (Overview links)', () => {
    renderPage({ route: '/transactions?period=all&category=1' });
    expect(rowsText()).toHaveLength(1);
    expect(rowsText()[0]).toContain('SWIGGY ORDER');
  });

  it('filters uncategorised with category=none', () => {
    renderPage({ route: '/transactions?period=all&category=none' });
    expect(rowsText()).toHaveLength(1);
    expect(rowsText()[0]).toContain('TEA STALL');
  });

  it('writes the category filter back to the URL', async () => {
    renderPage();
    const filter = screen.getByLabelText('Category', { selector: 'select' });
    await waitFor(() => expect(within(filter).getByRole('option', { name: 'Shopping' })).toBeInTheDocument());
    fireEvent.change(filter, { target: { value: '2' } });
    expect(screen.getByTestId('location').textContent).toContain('category=2');
    expect(rowsText()).toHaveLength(1);
  });

  it('searches descriptions', async () => {
    renderPage();
    fireEvent.change(screen.getByLabelText('Search transactions'), { target: { value: 'swig' } });
    await waitFor(() => expect(rowsText()).toHaveLength(1));
  });

  it('respects the global period', () => {
    const csv = makeTx([
      { date: '2025-03-10', amount: 10, description: 'RECENT' },
      { date: '2024-06-01', amount: 10, description: 'ANCIENT' },
    ]);
    renderPage({ route: '/transactions', csvData: csv });
    expect(screen.getByText('RECENT')).toBeInTheDocument();
    expect(screen.queryByText('ANCIENT')).not.toBeInTheDocument();
  });

  it(`paginates at ${PAGE_SIZE} rows`, () => {
    const many = makeTx(Array.from({ length: PAGE_SIZE + 5 }, (_, i) => ({
      date: `2025-03-${String((i % 28) + 1).padStart(2, '0')}`, amount: i + 1, description: `M${i}`,
    })));
    renderPage({ csvData: many });
    expect(rowsText()).toHaveLength(PAGE_SIZE);
    expect(screen.getByText('Page 1 of 2')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(rowsText()).toHaveLength(5);
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
  });

  it('shows the Card column only with multiple cards', () => {
    const { unmount } = renderPage();
    expect(screen.queryByRole('columnheader', { name: /Card/ })).not.toBeInTheDocument();
    unmount();
    renderPage({ cards: [{ id: 1, card_label: 'A' }, { id: 2, card_label: 'B' }] });
    expect(screen.getByRole('columnheader', { name: /Card/ })).toBeInTheDocument();
  });

  it('changes a category inline and refreshes data', async () => {
    const fetchMock = makeFetchMock({
      '/api/categories': { success: true, categories, rules: [] },
      '/api/transactions/3/category': { success: true },
    });
    global.fetch = fetchMock;
    const { onCategoryChange } = renderPage();
    const select = await screen.findByLabelText('Category for TEA STALL');
    await waitFor(() => expect(within(select).getByRole('option', { name: 'Dining' })).toBeInTheDocument());
    fireEvent.change(select, { target: { value: '1' } });
    await waitFor(() => expect(onCategoryChange).toHaveBeenCalled());
    const call = fetchMock.mock.calls.find(c => c[0] === '/api/transactions/3/category');
    expect(call[1].method).toBe('PUT');
    expect(JSON.parse(call[1].body)).toEqual({ categoryId: 1 });
    expect(call[1].headers['X-Requested-With']).toBe('paisa');
    expect(await screen.findByText('Category updated')).toBeInTheDocument();
  });

  it('exports with the current filters', async () => {
    const fetchMock = makeFetchMock({
      '/api/categories': { success: true, categories, rules: [] },
      '/api/export': { __response: { ok: true, status: 200, headers: { get: () => 'text/csv' }, blob: async () => new Blob(['a']) } },
    });
    global.fetch = fetchMock;
    URL.createObjectURL = vi.fn(() => 'blob:x');
    URL.revokeObjectURL = vi.fn();
    renderPage({ route: '/transactions?period=custom&from=2025-03-01&to=2025-03-31&category=2' });
    fireEvent.click(screen.getByRole('button', { name: 'Export CSV' }));
    await waitFor(() => expect(fetchMock.mock.calls.some(c => String(c[0]).startsWith('/api/export'))).toBe(true));
    const url = fetchMock.mock.calls.find(c => String(c[0]).startsWith('/api/export'))[0];
    expect(url).toContain('startDate=2025-03-01');
    expect(url).toContain('endDate=2025-03-31');
    expect(url).toContain('categoryId=2');
  });
});

describe('TransactionsPage with showCredits', () => {
  beforeEach(() => {
    setSettings({ showCredits: true });
    global.fetch = makeFetchMock({ '/api/categories': { success: true, categories, rules: [] } });
  });

  it('shows credits and a Type filter', () => {
    renderPage();
    expect(screen.getByText('REFUND AMAZON')).toBeInTheDocument();
    const group = screen.getByRole('radiogroup', { name: 'Type' });
    fireEvent.click(within(group).getByRole('radio', { name: 'Credits' }));
    expect(rowsText()).toHaveLength(1);
    expect(rowsText()[0]).toContain('REFUND AMAZON');
  });
});

describe('TransactionsPage (phone)', () => {
  let original;
  beforeEach(() => {
    original = window.matchMedia;
    window.matchMedia = (q) => ({
      matches: false, media: q, addEventListener() {}, removeEventListener() {},
    });
    global.fetch = makeFetchMock({ '/api/categories': { success: true, categories, rules: [] } });
  });
  afterEach(() => { window.matchMedia = original; });

  it('renders a list and opens a details sheet', async () => {
    renderPage();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /TEA STALL/ }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('heading', { name: 'TEA STALL' })).toBeInTheDocument();
    expect(within(dialog).getByLabelText('Category')).toBeInTheDocument();
  });

  it('loads more rows on demand', () => {
    const many = makeTx(Array.from({ length: PAGE_SIZE + 3 }, (_, i) => ({ date: '2025-03-10', amount: 5, description: `ROW${i}` })));
    renderPage({ csvData: many });
    expect(screen.getAllByRole('listitem')).toHaveLength(PAGE_SIZE);
    fireEvent.click(screen.getByRole('button', { name: 'Load 3 more' }));
    expect(screen.getAllByRole('listitem')).toHaveLength(PAGE_SIZE + 3);
  });
});
