import { describe, it, expect } from 'vitest';
import { parseCSV } from '../parser.js';
import { readFileSync } from 'fs';
import path from 'path';

describe('parseCSV', () => {
  it('should parse valid credit card CSV', async () => {
    const csvPath = path.join(process.cwd(), 'tests/fixtures/sample_valid.csv');
    const content = readFileSync(csvPath, 'utf-8');

    const result = await parseCSV(content);

    expect(result).toBeInstanceOf(Array);
    expect(result.length).toBeGreaterThan(0);
    expect(result[0]).toHaveProperty('date');
    expect(result[0]).toHaveProperty('amount');
    expect(result[0]).toHaveProperty('description');
    expect(result[0]).toHaveProperty('isCredit');
    expect(result[0]).toHaveProperty('type');
  });

  it('should skip first 25 metadata rows', async () => {
    const csvPath = path.join(process.cwd(), 'tests/fixtures/sample_valid.csv');
    const content = readFileSync(csvPath, 'utf-8');
    const lines = content.split('\n');

    // Verify file has metadata rows
    expect(lines[0]).toContain('Name~|~');

    const result = await parseCSV(content);

    // Results should not include metadata
    expect(result.some(tx => tx.description && tx.description.includes('Name~|~'))).toBe(false);
  });

  it('should handle ~|~ delimiter correctly', async () => {
    const csvPath = path.join(process.cwd(), 'tests/fixtures/sample_valid.csv');
    const content = readFileSync(csvPath, 'utf-8');

    const result = await parseCSV(content);

    // Should parse multiple columns separated by ~|~
    expect(result[0].description).not.toContain('~|~');
    expect(result[0].amount).toBeTypeOf('number');
  });

  it('should validate required columns (AMT, DATE)', async () => {
    const invalidCSV = 'Invalid~|~Data\nNo~|~Columns';

    await expect(parseCSV(invalidCSV)).rejects.toThrow('Invalid CSV format');
  });

  it('should filter out invalid transactions', async () => {
    const csvWithInvalid = `
${Array(25).fill('metadata~|~row').join('\n')}
Transaction type~|~Customer~|~DATE~|~Description~|~AMT~|~Debit /Credit~|~REWARDS
Domestic~|~Test~|~25/12/2025~|~Valid Store~|~100.50~|~~|~10
Domestic~|~Test~|~invalid-date~|~Invalid Date~|~200.00~|~~|~20
Domestic~|~Test~|~26/12/2025~|~Another Valid~|~not-a-number~|~~|~15
    `.trim();

    const result = await parseCSV(csvWithInvalid);

    // Should only include valid transaction
    expect(result.length).toBe(1);
    expect(result[0].amount).toBe(100.50);
  });

  it('should correctly identify credits vs debits', async () => {
    const csvWithCreditsDebits = `
${Array(25).fill('metadata~|~row').join('\n')}
Transaction type~|~Customer~|~DATE~|~Description~|~AMT~|~Debit /Credit~|~REWARDS
Domestic~|~Test~|~25/12/2025~|~Debit Transaction~|~100.50~|~~|~10
Domestic~|~Test~|~26/12/2025~|~Credit Transaction~|~50.00~|~Cr~|~5
    `.trim();

    const result = await parseCSV(csvWithCreditsDebits);

    expect(result.length).toBe(2);

    const debit = result.find(tx => tx.description === 'Debit Transaction');
    const credit = result.find(tx => tx.description === 'Credit Transaction');

    expect(debit.isCredit).toBe(false);
    expect(debit.type).toBe('Debit');

    expect(credit.isCredit).toBe(true);
    expect(credit.type).toBe('Credit');
  });

  it('should handle empty CSV gracefully', async () => {
    const emptyCSV = '';
    await expect(parseCSV(emptyCSV)).rejects.toThrow();
  });

  it('should handle CSV with only metadata rows', async () => {
    const metadataOnly = Array(30).fill('metadata~|~row').join('\n');
    await expect(parseCSV(metadataOnly)).rejects.toThrow();
  });

  it('should parse dates in DD/MM/YYYY format', async () => {
    const csvWithDate = `
${Array(25).fill('metadata~|~row').join('\n')}
Transaction type~|~Customer~|~DATE~|~Description~|~AMT~|~Debit /Credit~|~REWARDS
Domestic~|~Test~|~25/12/2025 10:30:00~|~Test Store~|~100.50~|~~|~10
    `.trim();

    const result = await parseCSV(csvWithDate);

    expect(result[0].date).toBe('2025-12-25');
  });

  it('should parse amounts with commas', async () => {
    const csvWithCommas = `
${Array(25).fill('metadata~|~row').join('\n')}
Transaction type~|~Customer~|~DATE~|~Description~|~AMT~|~Debit /Credit~|~REWARDS
Domestic~|~Test~|~25/12/2025~|~Test Store~|~1,234.56~|~~|~10
    `.trim();

    const result = await parseCSV(csvWithCommas);

    expect(result[0].amount).toBe(1234.56);
  });

  it('should handle Windows line endings (\\r\\n)', async () => {
    const csvWithWindowsEndings = [
      ...Array(25).fill('metadata~|~row'),
      'Transaction type~|~Customer~|~DATE~|~Description~|~AMT~|~Debit /Credit~|~REWARDS',
      'Domestic~|~Test~|~25/12/2025~|~Test Store~|~100.50~|~~|~10'
    ].join('\r\n');

    const result = await parseCSV(csvWithWindowsEndings);

    expect(result.length).toBe(1);
    expect(result[0].amount).toBe(100.50);
  });

  it('should handle Unix line endings (\\n)', async () => {
    const csvWithUnixEndings = [
      ...Array(25).fill('metadata~|~row'),
      'Transaction type~|~Customer~|~DATE~|~Description~|~AMT~|~Debit /Credit~|~REWARDS',
      'Domestic~|~Test~|~25/12/2025~|~Test Store~|~100.50~|~~|~10'
    ].join('\n');

    const result = await parseCSV(csvWithUnixEndings);

    expect(result.length).toBe(1);
    expect(result[0].amount).toBe(100.50);
  });

  it('should skip rows with missing required fields', async () => {
    const csvWithMissing = `
${Array(25).fill('metadata~|~row').join('\n')}
Transaction type~|~Customer~|~DATE~|~Description~|~AMT~|~Debit /Credit~|~REWARDS
Domestic~|~Test~|~25/12/2025~|~Valid~|~100.50~|~~|~10
Domestic~|~Test~|~~|~Missing Date~|~50.00~|~~|~5
Domestic~|~Test~|~26/12/2025~|~Missing Amount~|~~|~~|~5
    `.trim();

    const result = await parseCSV(csvWithMissing);

    expect(result.length).toBe(1);
    expect(result[0].description).toBe('Valid');
  });

  it('should reject CSV with no valid transactions', async () => {
    const csvPath = path.join(process.cwd(), 'tests/fixtures/sample_invalid.csv');
    const content = readFileSync(csvPath, 'utf-8');

    await expect(parseCSV(content)).rejects.toThrow('Invalid CSV format');
  });

  it('should handle malformed CSV and filter invalid rows', async () => {
    const csvPath = path.join(process.cwd(), 'tests/fixtures/sample_malformed.csv');
    const content = readFileSync(csvPath, 'utf-8');

    // Should reject because all transactions are invalid
    await expect(parseCSV(content)).rejects.toThrow();
  });

  it('should trim whitespace from fields', async () => {
    const csvWithWhitespace = `
${Array(25).fill('metadata~|~row').join('\n')}
Transaction type~|~Customer~|~DATE~|~Description~|~AMT~|~Debit /Credit~|~REWARDS
Domestic~|~Test~|~  25/12/2025  ~|~  Test Store  ~|~  100.50  ~|~~|~10
    `.trim();

    const result = await parseCSV(csvWithWhitespace);

    expect(result[0].date).toBe('2025-12-25');
    expect(result[0].amount).toBe(100.50);
    expect(result[0].description).toBe('Test Store');
  });
});
