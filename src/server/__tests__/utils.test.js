import { describe, it, expect } from 'vitest';
import { generateFileHash, generateTxHash, parseDate, parseAmount } from '../utils.js';

describe('generateFileHash', () => {
  it('should generate consistent SHA-256 hash for same content', () => {
    const content = 'test content';
    const hash1 = generateFileHash(content);
    const hash2 = generateFileHash(content);
    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(64); // SHA-256 is 64 hex chars
  });

  it('should generate different hashes for different content', () => {
    const hash1 = generateFileHash('content1');
    const hash2 = generateFileHash('content2');
    expect(hash1).not.toBe(hash2);
  });

  it('should handle empty string', () => {
    const hash = generateFileHash('');
    expect(hash).toBeTruthy();
    expect(hash).toHaveLength(64);
  });

  it('should be case-sensitive', () => {
    const hash1 = generateFileHash('Test');
    const hash2 = generateFileHash('test');
    expect(hash1).not.toBe(hash2);
  });
});

describe('generateTxHash', () => {
  it('should generate consistent hash for same transaction', () => {
    const hash1 = generateTxHash('2025-12-25', 100.50, 'Test Store');
    const hash2 = generateTxHash('2025-12-25', 100.50, 'Test Store');
    expect(hash1).toBe(hash2);
  });

  it('should normalize description (case-insensitive, trimmed)', () => {
    const hash1 = generateTxHash('2025-12-25', 100.50, 'Test Store');
    const hash2 = generateTxHash('2025-12-25', 100.50, '  TEST STORE  ');
    expect(hash1).toBe(hash2);
  });

  it('should generate different hashes for different amounts', () => {
    const hash1 = generateTxHash('2025-12-25', 100.50, 'Test Store');
    const hash2 = generateTxHash('2025-12-25', 100.51, 'Test Store');
    expect(hash1).not.toBe(hash2);
  });

  it('should normalize amount to 2 decimal places', () => {
    const hash1 = generateTxHash('2025-12-25', 100.5, 'Test');
    const hash2 = generateTxHash('2025-12-25', 100.50, 'Test');
    expect(hash1).toBe(hash2);
  });

  it('should generate different hashes for different dates', () => {
    const hash1 = generateTxHash('2025-12-25', 100.50, 'Test Store');
    const hash2 = generateTxHash('2025-12-26', 100.50, 'Test Store');
    expect(hash1).not.toBe(hash2);
  });

  it('should generate different hashes for different descriptions', () => {
    const hash1 = generateTxHash('2025-12-25', 100.50, 'Store A');
    const hash2 = generateTxHash('2025-12-25', 100.50, 'Store B');
    expect(hash1).not.toBe(hash2);
  });

  it('should normalize date to YYYY-MM-DD format', () => {
    const hash1 = generateTxHash('2025-12-25T00:00:00', 100, 'Test');
    const hash2 = generateTxHash('2025-12-25T23:59:59', 100, 'Test');
    expect(hash1).toBe(hash2);
  });
});

describe('parseDate', () => {
  it('should parse DD/MM/YYYY format to ISO', () => {
    expect(parseDate('25/12/2025 10:30:00')).toBe('2025-12-25');
    expect(parseDate('01/01/2026')).toBe('2026-01-01');
  });

  it('should handle edge dates (leap year, month boundaries)', () => {
    expect(parseDate('29/02/2024')).toBe('2024-02-29'); // Leap year
    expect(parseDate('31/12/2025')).toBe('2025-12-31');
    expect(parseDate('01/01/2000')).toBe('2000-01-01');
  });

  it('should parse dates without time component', () => {
    expect(parseDate('15/06/2025')).toBe('2025-06-15');
  });

  it('should parse dates with time component', () => {
    expect(parseDate('15/06/2025 14:30:45')).toBe('2025-06-15');
  });

  it('should throw error for invalid dates', () => {
    expect(() => parseDate('invalid')).toThrow('Invalid date');
  });

  it('should handle single-digit days and months', () => {
    expect(parseDate('05/03/2025')).toBe('2025-03-05');
    expect(parseDate('5/3/2025')).toBe('2025-03-05');
  });
});

describe('parseAmount', () => {
  it('should parse amounts with commas', () => {
    expect(parseAmount('1,234.56')).toBe(1234.56);
    expect(parseAmount('12,345,678.90')).toBe(12345678.90);
  });

  it('should parse amounts without commas', () => {
    expect(parseAmount('1234.56')).toBe(1234.56);
    expect(parseAmount('100')).toBe(100);
  });

  it('should handle decimal-only amounts', () => {
    expect(parseAmount('0.99')).toBe(0.99);
    expect(parseAmount('.50')).toBe(0.50);
  });

  it('should handle integer amounts', () => {
    expect(parseAmount('500')).toBe(500);
    expect(parseAmount('1,000')).toBe(1000);
  });

  it('should handle amounts with whitespace', () => {
    expect(parseAmount('  100.50  ')).toBe(100.50);
    expect(parseAmount(' 1,234.56 ')).toBe(1234.56);
  });

  it('should throw error for invalid amounts', () => {
    expect(() => parseAmount('abc')).toThrow('Invalid amount');
    expect(() => parseAmount('')).toThrow('Invalid amount');
    expect(() => parseAmount('   ')).toThrow('Invalid amount');
  });

  it('should handle numeric inputs (not just strings)', () => {
    expect(parseAmount(100.50)).toBe(100.50);
    expect(parseAmount(1000)).toBe(1000);
  });

  it('should handle negative amounts', () => {
    expect(parseAmount('-100.50')).toBe(-100.50);
    expect(parseAmount('-1,234.56')).toBe(-1234.56);
  });
});
