/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { resolveRange, previousRangeOf, describeRange } from '../utils/periods.js';
import { useFilters } from '../contexts/FilterContext';
import { makeTx, renderWithProviders } from './testUtils';

describe('period helpers', () => {
  const latest = new Date(2025, 2, 18); // 18 Mar 2025
  const today = new Date(2026, 9, 5);   // 5 Oct 2026

  it('latest = the month of data ending at the latest transaction', () => {
    expect(resolveRange('latest', { latest })).toEqual({ from: '2025-02-19', to: '2025-03-18' });
  });

  it('3m / 6m / 12m are relative to the latest transaction', () => {
    expect(resolveRange('3m', { latest })).toEqual({ from: '2024-12-19', to: '2025-03-18' });
    expect(resolveRange('12m', { latest })).toEqual({ from: '2024-03-19', to: '2025-03-18' });
  });

  it('clamps month arithmetic at month ends', () => {
    expect(resolveRange('latest', { latest: new Date(2025, 2, 31) })).toEqual({ from: '2025-03-01', to: '2025-03-31' });
  });

  it('this-month / last-month are calendar months of today', () => {
    expect(resolveRange('this-month', { latest, today })).toEqual({ from: '2026-10-01', to: '2026-10-05' });
    expect(resolveRange('last-month', { latest, today })).toEqual({ from: '2026-09-01', to: '2026-09-30' });
  });

  it('all and custom', () => {
    expect(resolveRange('all', { latest })).toEqual({ from: null, to: null });
    expect(resolveRange('custom', { from: '2025-01-01', to: '2025-01-15' })).toEqual({ from: '2025-01-01', to: '2025-01-15' });
  });

  it('previous range is the equal-length window just before', () => {
    expect(previousRangeOf({ from: '2025-03-01', to: '2025-03-31' })).toEqual({ from: '2025-01-29', to: '2025-02-28' });
    expect(previousRangeOf({ from: null, to: null })).toBeNull();
  });

  it('describes ranges for the hero sentence', () => {
    expect(describeRange('last-month', { from: '2026-09-01', to: '2026-09-30' })).toBe('in Sept 2026');
    expect(describeRange('latest', { from: '2025-02-19', to: '2025-03-18' })).toBe('from 19 Feb to 18 Mar 2025');
    expect(describeRange('all', { from: null, to: null }, '2024-01-03')).toBe('since 3 Jan 2024');
    expect(describeRange('this-month', { from: '2026-10-01', to: '2026-10-05' })).toBe('this month');
  });
});

function Probe() {
  const f = useFilters();
  return (
    <div>
      <span data-testid="count">{f.filtered.length}</span>
      <span data-testid="prev">{f.previousFiltered.length}</span>
      <span data-testid="range">{`${f.range.from}|${f.range.to}`}</span>
      <span data-testid="card">{String(f.cardId)}</span>
      <span data-testid="search">{f.filterSearch}</span>
      <button type="button" onClick={() => f.setPeriod('all')}>all</button>
      <button type="button" onClick={() => f.setCard('2')}>card2</button>
      <button type="button" onClick={() => f.setCustomRange('2025-03-01', '2025-03-05')}>custom</button>
    </div>
  );
}

const data = makeTx([
  { date: '2025-03-10', amount: 100, cardId: 1 },
  { date: '2025-03-01', amount: 100, cardId: 2 },
  { date: '2025-02-01', amount: 100, cardId: 1 },
  { date: '2024-01-01', amount: 100, cardId: 1 },
  { date: '2025-03-05', amount: 100, credit: true, description: 'CC PAYMENT THANK YOU' },
]);
const cards = [{ id: 1 }, { id: 2 }];

describe('FilterProvider', () => {
  it('defaults to the latest month of data and excludes CC payments', () => {
    renderWithProviders(<Probe />, { csvData: data, cards });
    expect(screen.getByTestId('range').textContent).toBe('2025-02-11|2025-03-10');
    expect(screen.getByTestId('count').textContent).toBe('2');
    expect(screen.getByTestId('prev').textContent).toBe('1');
  });

  it('reads card and period from the URL and ignores unknown cards', () => {
    renderWithProviders(<Probe />, { csvData: data, cards, route: '/?card=2&period=all' });
    expect(screen.getByTestId('count').textContent).toBe('1');
    expect(screen.getByTestId('card').textContent).toBe('2');
  });

  it('treats an unknown card id as all cards', () => {
    renderWithProviders(<Probe />, { csvData: data, cards, route: '/?card=99&period=all' });
    expect(screen.getByTestId('card').textContent).toBe('null');
    expect(screen.getByTestId('count').textContent).toBe('4');
  });

  it('updates the URL through setters and keeps other params', () => {
    renderWithProviders(<Probe />, { csvData: data, cards, route: '/transactions?category=3' });
    fireEvent.click(screen.getByText('all'));
    fireEvent.click(screen.getByText('card2'));
    const loc = screen.getByTestId('location').textContent;
    expect(loc).toContain('period=all');
    expect(loc).toContain('card=2');
    expect(loc).toContain('category=3');
    // nav links carry only the global filters
    expect(screen.getByTestId('search').textContent).toBe('?card=2&period=all');
  });

  it('supports a custom range', () => {
    renderWithProviders(<Probe />, { csvData: data, cards });
    fireEvent.click(screen.getByText('custom'));
    expect(screen.getByTestId('range').textContent).toBe('2025-03-01|2025-03-05');
    expect(screen.getByTestId('location').textContent).toContain('from=2025-03-01');
  });
});
