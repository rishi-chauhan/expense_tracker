/**
 * Shared helpers for page-level tests: real providers, realistic data.
 */
/* eslint-disable react-refresh/only-export-components -- test helpers, not HMR modules */
import React from 'react';
import { vi } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { SettingsProvider } from '../contexts/SettingsContext';
import { FilterProvider } from '../contexts/FilterContext';
import { ToastProvider } from '../components/ui/Toast';
import { transformTransactions } from '../hooks/useTransactions';

let nextId = 1;

/** Build component-shaped rows from compact API-like specs. */
export function makeTx(rows) {
  return transformTransactions(rows.map(r => ({
    id: r.id ?? nextId++,
    date: r.date,
    amount: r.amount,
    description: r.description ?? 'SHOP',
    is_credit: r.credit ? 1 : 0,
    type: r.credit ? 'Credit' : 'Domestic',
    card_id: r.cardId ?? 1,
    card_label: r.cardLabel ?? 'HDFC ...1234',
    bank_name: 'HDFC',
    category_id: r.categoryId ?? null,
    category_name: r.categoryName ?? null,
    category_color: r.categoryColor ?? null,
    category_manual: 0,
  })));
}

export function jsonResponse(data, { ok, status } = {}) {
  const resolvedOk = ok ?? (data.success !== false && !data.needsCardInfo && !data.isDuplicate);
  return {
    ok: resolvedOk,
    status: status ?? (data.needsCardInfo ? 422 : resolvedOk ? 200 : 400),
    headers: { get: () => 'application/json' },
    json: async () => data,
  };
}

/** URL-aware fetch mock: overrides keyed by pathname (without query). */
export function makeFetchMock(overrides = {}) {
  const defaults = {
    '/api/transactions': { success: true, transactions: [] },
    '/api/cards': { success: true, cards: [] },
    '/api/categories': { success: true, categories: [], rules: [] },
    '/api/budgets': { success: true, budgets: [], yearMonth: '2025-03' },
    '/api/recurring': { success: true, recurring: [] },
    '/api/chat/health': { success: true, available: true },
  };
  return vi.fn((url, init) => {
    const endpoint = typeof url === 'string' ? url.replace(/\?.*$/, '') : url;
    const override = overrides[endpoint];
    const data = typeof override === 'function' ? override(url, init) : override || defaults[endpoint] || { success: true };
    if (data && typeof data.then === 'function') return data;
    return Promise.resolve(data && data.__response ? data.__response : jsonResponse(data));
  });
}

export function setSettings(settings) {
  localStorage.setItem('expense-tracker-settings', JSON.stringify(settings));
}

/** Renders the current location so tests can assert on URL changes. */
export function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname + location.search}</div>;
}

export function renderWithProviders(ui, { route = '/', csvData = [], cards = [] } = {}) {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <SettingsProvider>
        <ToastProvider>
          <FilterProvider csvData={csvData} cards={cards}>
            {ui}
            <LocationProbe />
          </FilterProvider>
        </ToastProvider>
      </SettingsProvider>
    </MemoryRouter>
  );
}
