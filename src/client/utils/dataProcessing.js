/**
 * Shared data processing utilities for expense analytics.
 *
 * Hot paths use fields precomputed once in transformTransactions
 * (DateStr, Ts, MonthKey, WeekKey, DescLower, IsCCPayment). Every function
 * falls back to computing them so older-shaped data (tests) still works.
 */

/* ───────────── formatters (created once, reused) ───────────── */

const NUMBER_2DP = new Intl.NumberFormat('en-IN', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const NUMBER_0DP = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });
const COMPACT = new Intl.NumberFormat('en-IN', {
  notation: 'compact',
  maximumFractionDigits: 1,
});
const MONTH_LABEL = new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric' });
const WEEK_LABEL = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });
const WEEK_LABEL_YEAR = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

/** Format amount in Indian Rupee format: ₹1,23,456.78 */
export function formatINR(amount) {
  return '₹' + NUMBER_2DP.format(amount);
}

const DAY_FMT = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' });
const DAY_YEAR_FMT = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

/** '5 Oct' or '5 Oct 2026' for a Date or 'YYYY-MM-DD…' string (local date). */
export function formatDay(date, withYear = false) {
  let d = date;
  if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    const [y, m, dd] = date.split('-').map(Number);
    d = new Date(y, m - 1, dd);
  } else if (!(date instanceof Date)) {
    d = new Date(date);
  }
  if (Number.isNaN(d.getTime())) return '';
  return (withYear ? DAY_YEAR_FMT : DAY_FMT).format(d);
}

/** Whole rupees for headline figures: ₹1,23,457 */
export function formatINRWhole(amount) {
  return '₹' + NUMBER_0DP.format(amount);
}

/** Compact rupees for axis ticks / sub-labels: ₹950, ₹3.4K, ₹1.2L, ₹1.3Cr */
export function formatINRCompact(amount) {
  return '₹' + COMPACT.format(amount);
}

/* ───────────── date keys ───────────── */

const pad2 = (n) => String(n).padStart(2, '0');

/** Local-date 'YYYY-MM-DD' for a Date */
export function toDateKey(date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

/** 'YYYY-MM-DD' of the Monday starting the week that contains `date` (local) */
export function isoMondayString(date) {
  const day = date.getDay();
  const monday = new Date(date.getFullYear(), date.getMonth(), date.getDate() - (day === 0 ? 6 : day - 1));
  return toDateKey(monday);
}

/** Parse 'YYYY-MM-DD…' as LOCAL midnight (new Date(str) would be UTC). */
export function parseDateKey(str) {
  const [y, m, d] = str.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** Local Date for a transaction (works with old- and new-shape rows). */
function txDate(t) {
  if (t.Date instanceof Date) return t.Date;
  if (typeof t.Date === 'string' && /^\d{4}-\d{2}-\d{2}/.test(t.Date)) return parseDateKey(t.Date);
  return new Date(t.Date);
}

function txDateStr(t) {
  if (t.DateStr) return t.DateStr;
  const d = txDate(t);
  return isNaN(d.getTime()) ? '' : toDateKey(d);
}

function txMonthKey(t) {
  return t.MonthKey || txDateStr(t).slice(0, 7);
}

function txWeekKey(t) {
  if (t.WeekKey) return t.WeekKey;
  const d = txDate(t);
  return isNaN(d.getTime()) ? '' : isoMondayString(d);
}

/* ───────────── filters ───────────── */

/** Check if a transaction description is a CC payment */
export function isCCPayment(description) {
  if (!description) return false;
  const desc = description.toUpperCase();
  return desc.includes('CC PAYMENT') || desc.includes('BPPY');
}

/** Filter out CC payments and invalid entries from analytics data */
export function filterAnalyticsData(csvData) {
  if (!csvData || csvData.length === 0) return [];
  return csvData.filter(t => {
    if (t.IsCredit && (t.IsCCPayment ?? isCCPayment(t.Description))) return false;
    if (typeof t.Amount !== 'number' || Number.isNaN(t.Amount)) return false;
    if (t.Ts != null) return Number.isFinite(t.Ts);
    if (!t.Date || Number.isNaN(txDate(t).getTime())) return false;
    return true;
  });
}

/** Filter transactions by date range (inclusive, 'YYYY-MM-DD' strings) */
export function filterByDateRange(data, start, end) {
  if (!start && !end) return data;
  const s = start ? start.slice(0, 10) : null;
  const e = end ? end.slice(0, 10) : null;
  return data.filter(t => {
    const d = txDateStr(t);
    if (s && d < s) return false;
    if (e && d > e) return false;
    return true;
  });
}

/** Search transactions by description (case-insensitive) */
export function searchByDescription(data, query) {
  if (!query || !query.trim()) return data;
  const lower = query.trim().toLowerCase();
  return data.filter(t => {
    const desc = t.DescLower ?? (t.Description ? t.Description.toLowerCase() : '');
    return desc.includes(lower);
  });
}

/** Filter transactions by card */
export function filterByCard(data, cardId) {
  if (!cardId || cardId === 'all') return data;
  const id = String(cardId);
  return data.filter(t => String(t.CardId) === id);
}

/* ───────────── aggregations ───────────── */

/** Calculate summary statistics from filtered data (single pass) */
export function calculateSummaryStats(data) {
  let totalDebits = 0;
  let totalCredits = 0;
  for (const t of data) {
    if (t.IsCredit) totalCredits += t.Amount;
    else totalDebits += t.Amount;
  }
  return { totalDebits, totalCredits, netSpending: totalDebits - totalCredits };
}

/** Group transactions by month with chronological sort */
export function groupByMonth(data) {
  const byKey = new Map();
  for (const item of data) {
    if (!item.Date || !item.Amount) continue;
    const key = txMonthKey(item);
    if (!key) continue;
    let bucket = byKey.get(key);
    if (!bucket) {
      bucket = { debits: 0, credits: 0 };
      byKey.set(key, bucket);
    }
    if (item.IsCredit) bucket.credits += item.Amount;
    else bucket.debits += item.Amount;
  }

  const keys = [...byKey.keys()].sort();
  const monthlyData = {};
  const sortedMonths = [];
  for (const key of keys) {
    const [y, m] = key.split('-').map(Number);
    const label = MONTH_LABEL.format(new Date(y, m - 1, 1));
    monthlyData[label] = byKey.get(key);
    sortedMonths.push(label);
  }
  return { monthlyData, sortedMonths, monthKeys: keys };
}

/** Group transactions by week (Monday start) with chronological sort */
export function groupByWeek(data) {
  const byKey = new Map();
  for (const item of data) {
    if (!item.Date || !item.Amount) continue;
    const key = txWeekKey(item);
    if (!key) continue;
    let bucket = byKey.get(key);
    if (!bucket) {
      bucket = { debits: 0, credits: 0, _sortDate: parseDateKey(key).getTime() };
      byKey.set(key, bucket);
    }
    if (item.IsCredit) bucket.credits += item.Amount;
    else bucket.debits += item.Amount;
  }

  const keys = [...byKey.keys()].sort();
  // Add the year only when the same "Mon D" label would appear twice.
  const multiYear = new Set(keys.map(k => k.slice(0, 4))).size > 1;
  const fmt = multiYear ? WEEK_LABEL_YEAR : WEEK_LABEL;
  const weeklyData = {};
  const sortedWeeks = [];
  for (const key of keys) {
    const label = fmt.format(parseDateKey(key));
    weeklyData[label] = byKey.get(key);
    sortedWeeks.push(label);
  }
  return { weeklyData, sortedWeeks, weekKeys: keys };
}

/** Group transactions by description, sorted by total spend descending */
export function groupByDescription(data) {
  const grouped = new Map();
  for (const item of data) {
    if (!item.Description || !item.Amount || item.IsCredit) continue;
    const g = grouped.get(item.Description);
    if (g) {
      g.total += item.Amount;
      g.count += 1;
    } else {
      grouped.set(item.Description, { description: item.Description, total: item.Amount, count: 1 });
    }
  }
  return [...grouped.values()].sort((a, b) => b.total - a.total);
}

/** Group debit spending by category */
export function groupByCategory(data) {
  const grouped = new Map();
  for (const item of data || []) {
    if (!item.Amount || item.IsCredit) continue;
    const name = item.CategoryName || 'Uncategorized';
    let g = grouped.get(name);
    if (!g) {
      g = { name, total: 0, count: 0, color: item.CategoryColor || '#8b90a0', categoryId: item.CategoryId ?? null };
      grouped.set(name, g);
    }
    g.total += item.Amount;
    g.count += 1;
  }
  return [...grouped.values()].sort((a, b) => b.total - a.total);
}

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/**
 * Average debit spend per weekday (Mon..Sun) over the days covered by the
 * data's date span. Returns [{ day, total, average }].
 */
export function spendByWeekday(data) {
  const totals = new Array(7).fill(0);
  let minTs = Infinity;
  let maxTs = -Infinity;
  for (const t of data) {
    if (t.IsCredit || !t.Amount) continue;
    const d = t.Ts != null ? new Date(t.Ts) : txDate(t);
    const ts = d.getTime();
    if (!Number.isFinite(ts)) continue;
    totals[(d.getDay() + 6) % 7] += t.Amount;
    if (ts < minTs) minTs = ts;
    if (ts > maxTs) maxTs = ts;
  }
  if (!Number.isFinite(minTs)) return WEEKDAYS.map(day => ({ day, total: 0, average: 0 }));

  // Count how many of each weekday the span contains.
  const counts = new Array(7).fill(0);
  const start = new Date(minTs);
  const days = Math.round((maxTs - minTs) / 86_400_000) + 1;
  for (let i = 0; i < Math.min(days, 7); i++) {
    counts[(start.getDay() + i + 6) % 7] += Math.floor((days - i - 1) / 7) + 1;
  }
  return WEEKDAYS.map((day, i) => ({
    day,
    total: totals[i],
    average: counts[i] ? totals[i] / counts[i] : 0,
  }));
}
