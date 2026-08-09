import { describe, it, expect } from 'vitest';
import {
  isCCPayment,
  filterAnalyticsData,
  calculateSummaryStats,
  groupByMonth,
  groupByWeek,
  groupByDescription,
  groupByCategory,
  filterByDateRange,
  searchByDescription,
  formatINR,
} from '../utils/dataProcessing.js';

const sampleData = [
  { Date: new Date('2025-01-15'), Amount: 500, Description: 'Grocery Store', IsCredit: false },
  { Date: new Date('2025-01-20'), Amount: 200, Description: 'Gas Station', IsCredit: false },
  { Date: new Date('2025-02-10'), Amount: 1000, Description: 'Grocery Store', IsCredit: false },
  { Date: new Date('2025-02-15'), Amount: 300, Description: 'Restaurant', IsCredit: false },
  { Date: new Date('2025-01-25'), Amount: 5000, Description: 'CC PAYMENT', IsCredit: true },
  { Date: new Date('2025-02-20'), Amount: 150, Description: 'Refund', IsCredit: true },
];

describe('isCCPayment', () => {
  it('should detect CC PAYMENT', () => {
    expect(isCCPayment('CC PAYMENT')).toBe(true);
    expect(isCCPayment('cc payment something')).toBe(true);
  });

  it('should detect BPPY', () => {
    expect(isCCPayment('BPPY12345')).toBe(true);
  });

  it('should return false for regular descriptions', () => {
    expect(isCCPayment('Grocery Store')).toBe(false);
    expect(isCCPayment('Restaurant')).toBe(false);
  });

  it('should handle null/undefined', () => {
    expect(isCCPayment(null)).toBe(false);
    expect(isCCPayment(undefined)).toBe(false);
    expect(isCCPayment('')).toBe(false);
  });
});

describe('filterAnalyticsData', () => {
  it('should filter out CC payments from credits', () => {
    const result = filterAnalyticsData(sampleData);
    expect(result).toHaveLength(5); // CC PAYMENT removed, Refund kept
    expect(result.find(t => t.Description === 'CC PAYMENT')).toBeUndefined();
    expect(result.find(t => t.Description === 'Refund')).toBeDefined();
  });

  it('should filter out invalid amounts', () => {
    const data = [
      { Date: new Date('2025-01-15'), Amount: NaN, Description: 'Test', IsCredit: false },
      { Date: new Date('2025-01-15'), Amount: 100, Description: 'Valid', IsCredit: false },
    ];
    expect(filterAnalyticsData(data)).toHaveLength(1);
  });

  it('should filter out invalid dates', () => {
    const data = [
      { Date: null, Amount: 100, Description: 'Test', IsCredit: false },
      { Date: new Date('2025-01-15'), Amount: 100, Description: 'Valid', IsCredit: false },
    ];
    expect(filterAnalyticsData(data)).toHaveLength(1);
  });

  it('should return empty array for null/empty input', () => {
    expect(filterAnalyticsData(null)).toEqual([]);
    expect(filterAnalyticsData([])).toEqual([]);
  });
});

describe('calculateSummaryStats', () => {
  it('should calculate totals correctly', () => {
    const filtered = filterAnalyticsData(sampleData);
    const stats = calculateSummaryStats(filtered);
    expect(stats.totalDebits).toBe(2000);
    expect(stats.totalCredits).toBe(150);
    expect(stats.netSpending).toBe(1850);
  });

  it('should handle empty data', () => {
    const stats = calculateSummaryStats([]);
    expect(stats.totalDebits).toBe(0);
    expect(stats.totalCredits).toBe(0);
    expect(stats.netSpending).toBe(0);
  });
});

describe('groupByMonth', () => {
  it('should group transactions by month', () => {
    const filtered = filterAnalyticsData(sampleData);
    const { monthlyData, sortedMonths } = groupByMonth(filtered);
    expect(sortedMonths.length).toBe(2);
    expect(monthlyData[sortedMonths[0]].debits).toBe(700);
    expect(monthlyData[sortedMonths[1]].debits).toBe(1300);
  });

  it('should sort months chronologically', () => {
    const filtered = filterAnalyticsData(sampleData);
    const { sortedMonths } = groupByMonth(filtered);
    expect(new Date(sortedMonths[0]).getTime()).toBeLessThan(new Date(sortedMonths[1]).getTime());
  });
});

describe('groupByWeek', () => {
  it('should group transactions by week', () => {
    const filtered = filterAnalyticsData(sampleData);
    const { sortedWeeks } = groupByWeek(filtered);
    expect(sortedWeeks.length).toBeGreaterThan(0);
  });
});

describe('groupByDescription', () => {
  it('should group by description and sort by total descending', () => {
    const filtered = filterAnalyticsData(sampleData);
    const grouped = groupByDescription(filtered);
    // Only debit transactions are grouped
    expect(grouped[0].description).toBe('Grocery Store');
    expect(grouped[0].total).toBe(1500);
    expect(grouped[0].count).toBe(2);
  });

  it('should exclude credits from grouping', () => {
    const filtered = filterAnalyticsData(sampleData);
    const grouped = groupByDescription(filtered);
    expect(grouped.find(g => g.description === 'Refund')).toBeUndefined();
  });
});

describe('groupByCategory', () => {
  it('should aggregate debits by category name', () => {
    const data = [
      { Amount: 100, IsCredit: false, CategoryName: 'Dining', CategoryColor: '#fb923c', CategoryId: 1 },
      { Amount: 50, IsCredit: false, CategoryName: 'Dining', CategoryColor: '#fb923c', CategoryId: 1 },
      { Amount: 200, IsCredit: false, CategoryName: 'Transport', CategoryColor: '#60a5fa', CategoryId: 2 },
      { Amount: 80, IsCredit: true, CategoryName: 'Dining', CategoryColor: '#fb923c', CategoryId: 1 },
    ];
    const grouped = groupByCategory(data);
    expect(grouped[0].name).toBe('Transport');
    expect(grouped[0].total).toBe(200);
    expect(grouped[1].name).toBe('Dining');
    expect(grouped[1].total).toBe(150);
  });
});

describe('filterByDateRange', () => {
  it('should filter by start date', () => {
    const result = filterByDateRange(sampleData, '2025-02-01', '');
    expect(result).toHaveLength(3);
  });

  it('should filter by end date', () => {
    const result = filterByDateRange(sampleData, '', '2025-01-31');
    expect(result).toHaveLength(3);
  });

  it('should filter by both dates', () => {
    const result = filterByDateRange(sampleData, '2025-01-20', '2025-02-10');
    expect(result).toHaveLength(3); // Jan 20, Jan 25, Feb 10
  });

  it('should return all data when no range specified', () => {
    const result = filterByDateRange(sampleData, '', '');
    expect(result).toHaveLength(sampleData.length);
  });
});

describe('searchByDescription', () => {
  it('should search case-insensitively', () => {
    const result = searchByDescription(sampleData, 'grocery');
    expect(result).toHaveLength(2);
  });

  it('should return all data for empty query', () => {
    expect(searchByDescription(sampleData, '')).toHaveLength(sampleData.length);
    expect(searchByDescription(sampleData, null)).toHaveLength(sampleData.length);
  });

  it('should return empty for no matches', () => {
    expect(searchByDescription(sampleData, 'xyz123')).toHaveLength(0);
  });
});

describe('formatINR', () => {
  it('should format with rupee symbol', () => {
    const result = formatINR(1000);
    expect(result).toContain('₹');
    expect(result).toContain('1,000');
  });

  it('should include 2 decimal places', () => {
    const result = formatINR(50);
    expect(result).toContain('.00');
  });
});
