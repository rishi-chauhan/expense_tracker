/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import TransactionExplorer from '../components/TransactionExplorer';

let mockShowCredits = true;
vi.mock('../contexts/SettingsContext', () => ({
  useSettings: () => ({ showCredits: mockShowCredits, toggleShowCredits: () => {} }),
}));

const makeData = (overrides = []) => overrides.map((o, i) => ({
  Date: new Date(`2025-01-${String(15 + i).padStart(2, '0')}`),
  Amount: 100 + i * 50,
  IsCredit: false,
  Type: 'Debit',
  Description: `Merchant${i}`,
  ...o,
}));

describe('TransactionExplorer', () => {
  beforeEach(() => {
    mockShowCredits = true;
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => 'application/json' },
      json: async () => ({ success: true, categories: [], rules: [] }),
    });
  });

  it('shows empty message for null data', () => {
    render(<TransactionExplorer data={null} />);
    expect(screen.getByText('No transactions to display.')).toBeInTheDocument();
  });

  it('shows empty message for empty array', () => {
    render(<TransactionExplorer data={[]} />);
    expect(screen.getByText('No transactions to display.')).toBeInTheDocument();
  });

  it('renders table with correct row count and subtitle', () => {
    const data = makeData([
      { Date: new Date('2025-01-15'), Amount: 100, Description: 'A' },
      { Date: new Date('2025-01-16'), Amount: 200, Description: 'B' },
      { Date: new Date('2025-01-17'), Amount: 300, Description: 'C' },
    ]);

    render(<TransactionExplorer data={data} />);

    expect(screen.getByText('3 transactions')).toBeInTheDocument();
    expect(screen.getByText('Transaction Explorer')).toBeInTheDocument();

    // Check column headers exist
    expect(screen.getByText(/^Date/)).toBeInTheDocument();
    expect(screen.getByText('Description')).toBeInTheDocument();
    expect(screen.getByText(/^Amount/)).toBeInTheDocument();
    expect(screen.getByText('Type')).toBeInTheDocument();

    // 3 data rows in the table body
    const rows = document.querySelectorAll('tbody tr');
    expect(rows).toHaveLength(3);
  });

  it('defaults to Date descending sort', () => {
    const data = makeData([
      { Date: new Date('2025-01-10'), Amount: 100, Description: 'Early' },
      { Date: new Date('2025-01-20'), Amount: 200, Description: 'Late' },
    ]);

    render(<TransactionExplorer data={data} />);

    // Date header should show down arrow
    const dateHeader = screen.getByText(/^Date/);
    expect(dateHeader.textContent).toContain('↓');

    // First row should be the latest date
    const rows = document.querySelectorAll('tbody tr');
    expect(rows[0].textContent).toContain('Late');
  });

  it('toggles Date sort direction on click', () => {
    const data = makeData([
      { Date: new Date('2025-01-10'), Amount: 100, Description: 'Early' },
      { Date: new Date('2025-01-20'), Amount: 200, Description: 'Late' },
    ]);

    render(<TransactionExplorer data={data} />);

    // Click Date header to toggle to ascending
    fireEvent.click(screen.getByText(/^Date/));

    const dateHeader = screen.getByText(/^Date/);
    expect(dateHeader.textContent).toContain('↑');

    // First row should now be the earliest date
    const rows = document.querySelectorAll('tbody tr');
    expect(rows[0].textContent).toContain('Early');
  });

  it('sorts by Amount when clicking Amount header', () => {
    const data = makeData([
      { Date: new Date('2025-01-15'), Amount: 50, Description: 'Small' },
      { Date: new Date('2025-01-16'), Amount: 500, Description: 'Big' },
      { Date: new Date('2025-01-17'), Amount: 200, Description: 'Medium' },
    ]);

    render(<TransactionExplorer data={data} />);

    // Click Amount header
    fireEvent.click(screen.getByText(/^Amount/));

    const amountHeader = screen.getByText(/^Amount/);
    expect(amountHeader.textContent).toContain('↓');

    // First row should be highest amount
    const rows = document.querySelectorAll('tbody tr');
    expect(rows[0].textContent).toContain('Big');
  });

  it('shows correct type badges', () => {
    const data = makeData([
      { Date: new Date('2025-01-15'), Amount: 100, IsCredit: false, Type: 'Debit', Description: 'Purchase' },
      { Date: new Date('2025-01-16'), Amount: 50, IsCredit: true, Type: 'Credit', Description: 'Refund' },
    ]);

    render(<TransactionExplorer data={data} />);

    const debitBadges = document.querySelectorAll('.tx-badge.debit');
    const creditBadges = document.querySelectorAll('.tx-badge.credit');

    expect(debitBadges).toHaveLength(1);
    expect(creditBadges).toHaveLength(1);
    expect(debitBadges[0].textContent).toBe('Debit');
    expect(creditBadges[0].textContent).toBe('Credit');
  });

  it('does not show pagination for 25 or fewer rows', () => {
    const data = makeData(
      Array.from({ length: 10 }, (_, i) => ({
        Date: new Date(`2025-01-${String(i + 1).padStart(2, '0')}`),
        Amount: 100 + i,
        Description: `Item ${i}`,
      }))
    );

    render(<TransactionExplorer data={data} />);

    expect(screen.queryByText('Previous')).not.toBeInTheDocument();
    expect(screen.queryByText('Next')).not.toBeInTheDocument();
  });

  it('shows pagination for more than 25 rows', () => {
    const data = makeData(
      Array.from({ length: 30 }, (_, i) => ({
        Date: new Date(`2025-${String(Math.floor(i / 28) + 1).padStart(2, '0')}-${String((i % 28) + 1).padStart(2, '0')}`),
        Amount: 100 + i,
        Description: `Item ${i}`,
      }))
    );

    render(<TransactionExplorer data={data} />);

    expect(screen.getByText('Previous')).toBeInTheDocument();
    expect(screen.getByText('Next')).toBeInTheDocument();
    expect(screen.getByText('Page 1 of 2')).toBeInTheDocument();

    // Previous should be disabled on first page
    expect(screen.getByText('Previous')).toBeDisabled();
    expect(screen.getByText('Next')).not.toBeDisabled();

    // Should show 25 rows on first page
    const rows = document.querySelectorAll('tbody tr');
    expect(rows).toHaveLength(25);
  });

  it('navigates between pages', () => {
    const data = makeData(
      Array.from({ length: 30 }, (_, i) => ({
        Date: new Date(`2025-${String(Math.floor(i / 28) + 1).padStart(2, '0')}-${String((i % 28) + 1).padStart(2, '0')}`),
        Amount: 100 + i,
        Description: `Item ${i}`,
      }))
    );

    render(<TransactionExplorer data={data} />);

    // Go to page 2
    fireEvent.click(screen.getByText('Next'));

    expect(screen.getByText('Page 2 of 2')).toBeInTheDocument();

    // Page 2 should have remaining rows
    const rows = document.querySelectorAll('tbody tr');
    expect(rows).toHaveLength(5);

    // Next should be disabled on last page, Previous enabled
    expect(screen.getByText('Next')).toBeDisabled();
    expect(screen.getByText('Previous')).not.toBeDisabled();

    // Go back to page 1
    fireEvent.click(screen.getByText('Previous'));
    expect(screen.getByText('Page 1 of 2')).toBeInTheDocument();
  });
});

describe('TransactionExplorer with showCredits=false', () => {
  beforeEach(() => {
    mockShowCredits = false;
  });

  it('filters out credit transactions', () => {
    const data = makeData([
      { Date: new Date('2025-01-15'), Amount: 100, IsCredit: false, Type: 'Debit', Description: 'Purchase' },
      { Date: new Date('2025-01-16'), Amount: 50, IsCredit: true, Type: 'Credit', Description: 'Refund' },
      { Date: new Date('2025-01-17'), Amount: 200, IsCredit: false, Type: 'Debit', Description: 'Store' },
    ]);

    render(<TransactionExplorer data={data} />);

    expect(screen.getByText('2 transactions')).toBeInTheDocument();
    const rows = document.querySelectorAll('tbody tr');
    expect(rows).toHaveLength(2);
  });

  it('hides the Type column', () => {
    const data = makeData([
      { Date: new Date('2025-01-15'), Amount: 100, IsCredit: false, Type: 'Debit', Description: 'Purchase' },
    ]);

    render(<TransactionExplorer data={data} />);

    expect(screen.queryByText('Type')).not.toBeInTheDocument();
    expect(document.querySelectorAll('.tx-badge')).toHaveLength(0);
  });
});
