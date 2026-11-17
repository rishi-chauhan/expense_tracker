import React, { createContext, useCallback, useContext, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  filterAnalyticsData,
  filterByCard,
  filterByDateRange,
  parseDateKey,
  toDateKey,
} from '../utils/dataProcessing.js';
import {
  PERIODS,
  resolveRange,
  previousRangeOf,
  describeRange,
} from '../utils/periods.js';

export { PERIODS };

const PERIOD_VALUES = new Set(PERIODS.map(p => p.value));
const FILTER_KEYS = ['card', 'period', 'from', 'to'];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Global filters (card + period), stored in the URL so they survive reloads,
 * bookmarks and page switches:
 *   ?card=<id>&period=latest|this-month|last-month|3m|6m|12m|all|custom&from=&to=
 *
 * `filtered` = card filter + analytics filter (no CC payments) + date range,
 * computed once here and shared by every page.
 */
const FilterContext = createContext(null);

export function FilterProvider({ csvData, cards = [], children }) {
  const [params, setParams] = useSearchParams();

  const rawCard = params.get('card');
  const cardId = rawCard && cards.some(c => String(c.id) === rawCard) ? rawCard : null;
  const rawPeriod = params.get('period');
  const period = PERIOD_VALUES.has(rawPeriod) ? rawPeriod : 'latest';
  const customFrom = DATE_RE.test(params.get('from') || '') ? params.get('from') : null;
  const customTo = DATE_RE.test(params.get('to') || '') ? params.get('to') : null;

  // Card + analytics filter, before any date filtering.
  const analytics = useMemo(
    () => filterAnalyticsData(filterByCard(csvData || [], cardId || 'all')),
    [csvData, cardId]
  );

  const { latestDate, firstDate } = useMemo(() => {
    let max = '';
    let min = '';
    for (const t of analytics) {
      const d = t.DateStr || (t.Date instanceof Date ? toDateKey(t.Date) : '');
      if (!d) continue;
      if (d > max) max = d;
      if (!min || d < min) min = d;
    }
    return { latestDate: max || null, firstDate: min || null };
  }, [analytics]);

  const range = useMemo(
    () => resolveRange(period, {
      latest: latestDate ? parseDateKey(latestDate) : null,
      from: customFrom,
      to: customTo,
    }),
    [period, latestDate, customFrom, customTo]
  );

  const previousRange = useMemo(() => previousRangeOf(range), [range]);

  const filtered = useMemo(
    () => filterByDateRange(analytics, range.from, range.to),
    [analytics, range]
  );
  const previousFiltered = useMemo(
    () => (previousRange ? filterByDateRange(analytics, previousRange.from, previousRange.to) : []),
    [analytics, previousRange]
  );

  const update = useCallback((changes) => {
    setParams(prev => {
      const next = new URLSearchParams(prev);
      for (const [k, v] of Object.entries(changes)) {
        if (v == null || v === '') next.delete(k);
        else next.set(k, v);
      }
      return next;
    }, { replace: true });
  }, [setParams]);

  const setCard = useCallback((id) => update({ card: id && id !== 'all' ? String(id) : null }), [update]);
  const setPeriod = useCallback((p) => {
    if (p === 'custom') {
      update({ period: 'custom', from: range.from, to: range.to });
    } else {
      update({ period: p === 'latest' ? null : p, from: null, to: null });
    }
  }, [update, range]);
  const setCustomRange = useCallback((from, to) => update({ period: 'custom', from, to }), [update]);

  /** Query string carrying only the global filters, for nav links. */
  const filterSearch = useMemo(() => {
    const out = new URLSearchParams();
    for (const k of FILTER_KEYS) {
      const v = params.get(k);
      if (v) out.set(k, v);
    }
    const s = out.toString();
    return s ? `?${s}` : '';
  }, [params]);

  const value = useMemo(() => ({
    cardId,
    period,
    range,
    previousRange,
    filtered,
    previousFiltered,
    analytics,
    latestDate,
    firstDate,
    rangeLabel: describeRange(period, range, firstDate),
    filterSearch,
    setCard,
    setPeriod,
    setCustomRange,
  }), [cardId, period, range, previousRange, filtered, previousFiltered, analytics,
    latestDate, firstDate, filterSearch, setCard, setPeriod, setCustomRange]);

  return <FilterContext.Provider value={value}>{children}</FilterContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useFilters() {
  const ctx = useContext(FilterContext);
  if (!ctx) throw new Error('useFilters must be used inside <FilterProvider>');
  return ctx;
}
