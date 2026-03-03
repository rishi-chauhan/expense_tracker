/**
 * Shared data processing utilities for expense analytics.
 */

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
    if (t.IsCredit && isCCPayment(t.Description)) return false;
    if (typeof t.Amount !== 'number' || isNaN(t.Amount)) return false;
    if (!t.Date || isNaN(new Date(t.Date).getTime())) return false;
    return true;
  });
}

/** Calculate summary statistics from filtered data */
export function calculateSummaryStats(data) {
  const totalDebits = data
    .filter(t => !t.IsCredit)
    .reduce((sum, t) => sum + t.Amount, 0);

  const totalCredits = data
    .filter(t => t.IsCredit)
    .reduce((sum, t) => sum + t.Amount, 0);

  const netSpending = totalDebits - totalCredits;

  return { totalDebits, totalCredits, netSpending };
}

/** Group transactions by month with chronological sort */
export function groupByMonth(data) {
  const monthlyData = data.reduce((acc, item) => {
    if (!item.Date || !item.Amount) return acc;

    const date = new Date(item.Date);
    if (isNaN(date.getTime())) return acc;

    const monthYear = date.toLocaleDateString('en-US', {
      month: 'short',
      year: 'numeric'
    });

    if (!acc[monthYear]) {
      acc[monthYear] = { debits: 0, credits: 0 };
    }

    if (item.IsCredit) {
      acc[monthYear].credits += item.Amount;
    } else {
      acc[monthYear].debits += item.Amount;
    }

    return acc;
  }, {});

  const sortedMonths = Object.keys(monthlyData).sort((a, b) => {
    return new Date(a) - new Date(b);
  });

  return { monthlyData, sortedMonths };
}

/** Group transactions by week with chronological sort */
export function groupByWeek(data) {
  const weeklyData = data.reduce((acc, item) => {
    if (!item.Date || !item.Amount) return acc;

    const date = new Date(item.Date);
    if (isNaN(date.getTime())) return acc;

    // Get Monday of the week
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(date);
    monday.setDate(diff);

    const weekLabel = monday.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    });

    if (!acc[weekLabel]) {
      acc[weekLabel] = { debits: 0, credits: 0, _sortDate: monday.getTime() };
    }

    if (item.IsCredit) {
      acc[weekLabel].credits += item.Amount;
    } else {
      acc[weekLabel].debits += item.Amount;
    }

    return acc;
  }, {});

  const sortedWeeks = Object.keys(weeklyData).sort((a, b) => {
    return weeklyData[a]._sortDate - weeklyData[b]._sortDate;
  });

  return { weeklyData, sortedWeeks };
}

/** Group transactions by description, sorted by total spend descending */
export function groupByDescription(data) {
  const grouped = data.reduce((acc, item) => {
    if (!item.Description || !item.Amount || item.IsCredit) return acc;

    const desc = item.Description;
    if (!acc[desc]) {
      acc[desc] = { total: 0, count: 0 };
    }
    acc[desc].total += item.Amount;
    acc[desc].count += 1;

    return acc;
  }, {});

  return Object.entries(grouped)
    .map(([description, { total, count }]) => ({ description, total, count }))
    .sort((a, b) => b.total - a.total);
}

/** Filter transactions by date range */
export function filterByDateRange(data, start, end) {
  if (!start && !end) return data;
  return data.filter(t => {
    const date = new Date(t.Date);
    if (start && date < new Date(start)) return false;
    if (end && date > new Date(end + 'T23:59:59')) return false;
    return true;
  });
}

/** Search transactions by description (case-insensitive) */
export function searchByDescription(data, query) {
  if (!query || !query.trim()) return data;
  const lower = query.toLowerCase();
  return data.filter(t =>
    t.Description && t.Description.toLowerCase().includes(lower)
  );
}

/** Filter transactions by card */
export function filterByCard(data, cardId) {
  if (!cardId || cardId === 'all') return data;
  return data.filter(t => String(t.CardId) === String(cardId));
}

/** Format amount in Indian Rupee format */
export function formatINR(amount) {
  return '₹' + amount.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}
