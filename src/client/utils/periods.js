/**
 * Period helpers for the global filter (pure functions, unit-tested).
 */
import { parseDateKey, toDateKey } from './dataProcessing.js';

export const PERIODS = [
  { value: 'latest', label: 'Latest', short: 'Latest month' },
  { value: 'this-month', label: 'This month', short: 'This month' },
  { value: 'last-month', label: 'Last month', short: 'Last month' },
  { value: '3m', label: '3M', short: '3 months' },
  { value: '6m', label: '6M', short: '6 months' },
  { value: '12m', label: '12M', short: '12 months' },
  { value: 'all', label: 'All', short: 'All time' },
  { value: 'custom', label: 'Custom', short: 'Custom' },
];

const DAY_MS = 86_400_000;
const DAY_FMT = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' });
const DAY_YEAR_FMT = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
const MONTH_FMT = new Intl.DateTimeFormat('en-GB', { month: 'short', year: 'numeric' });

function addMonths(date, n) {
  const d = new Date(date.getFullYear(), date.getMonth() + n, date.getDate());
  // Clamp e.g. 31 Mar - 1 month → 28/29 Feb instead of rolling into March.
  if (d.getDate() !== date.getDate()) d.setDate(0);
  return d;
}

function addDays(date, n) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + n);
}

/** Resolve a period to an inclusive { from, to } of 'YYYY-MM-DD' (nulls = open). */
export function resolveRange(period, { latest, today = new Date(), from, to } = {}) {
  const anchor = latest || today;
  switch (period) {
    case 'all':
      return { from: null, to: null };
    case 'custom':
      return { from: from || null, to: to || null };
    case 'this-month': {
      const start = new Date(today.getFullYear(), today.getMonth(), 1);
      return { from: toDateKey(start), to: toDateKey(today) };
    }
    case 'last-month': {
      const start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const end = new Date(today.getFullYear(), today.getMonth(), 0);
      return { from: toDateKey(start), to: toDateKey(end) };
    }
    case '3m':
    case '6m':
    case '12m': {
      const months = Number(period.slice(0, -1));
      return { from: toDateKey(addDays(addMonths(anchor, -months), 1)), to: toDateKey(anchor) };
    }
    case 'latest':
    default:
      // Most recent month of data (same window the old dashboard used).
      return { from: toDateKey(addDays(addMonths(anchor, -1), 1)), to: toDateKey(anchor) };
  }
}

/** The equal-length window immediately before `range` (null for open ranges). */
export function previousRangeOf(range) {
  if (!range.from || !range.to) return null;
  const from = parseDateKey(range.from);
  const to = parseDateKey(range.to);
  const days = Math.round((to - from) / DAY_MS) + 1;
  const prevTo = addDays(from, -1);
  return { from: toDateKey(addDays(prevTo, -(days - 1))), to: toDateKey(prevTo) };
}

/** Human phrase for the hero sentence: "in Oct 2026", "from 3 Sep to 2 Oct 2026"… */
export function describeRange(period, range, firstDate) {
  if (period === 'all' || (!range.from && !range.to)) {
    return firstDate ? `since ${DAY_YEAR_FMT.format(parseDateKey(firstDate))}` : 'in total';
  }
  if (period === 'this-month') return 'this month';
  if (range.from && range.to) {
    const f = parseDateKey(range.from);
    const t = parseDateKey(range.to);
    const wholeMonth = f.getDate() === 1 && addDays(t, 1).getDate() === 1
      && f.getMonth() === t.getMonth() && f.getFullYear() === t.getFullYear();
    if (wholeMonth) return `in ${MONTH_FMT.format(f)}`;
    const sameYear = f.getFullYear() === t.getFullYear();
    return `from ${(sameYear ? DAY_FMT : DAY_YEAR_FMT).format(f)} to ${DAY_YEAR_FMT.format(t)}`;
  }
  if (range.from) return `since ${DAY_YEAR_FMT.format(parseDateKey(range.from))}`;
  return `until ${DAY_YEAR_FMT.format(parseDateKey(range.to))}`;
}
