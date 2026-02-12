import { describe, it, expect } from 'vitest';
import { parseCSV, extractStatementMetadata } from '../parser.js';
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

    await expect(parseCSV(invalidCSV)).rejects.toThrow('Could not find header row with DATE and AMT columns');
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
Domestic~|~Test~|~15/06/2025~|~Test Store~|~100.50~|~~|~10
    `.trim();

    const result = await parseCSV(csvWithDate);

    // Verify date is parsed and in ISO format
    expect(result[0].date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(result[0].date).toContain('2025-06');
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

    await expect(parseCSV(content)).rejects.toThrow();
  });

  it('should handle malformed CSV and filter invalid rows', async () => {
    const csvPath = path.join(process.cwd(), 'tests/fixtures/sample_malformed.csv');
    const content = readFileSync(csvPath, 'utf-8');

    // Should reject because all transactions are invalid
    await expect(parseCSV(content)).rejects.toThrow();
  });

  it('should trim whitespace from fields', async () => {
    const csvWithWhitespace = `
Statement Date~|~15/06/2025
Transaction type~|~Customer~|~DATE~|~Description~|~AMT~|~Debit /Credit~|~REWARDS
Domestic~|~Test~|~  15/06/2025  ~|~  Test Store  ~|~  100.50  ~|~~|~10
    `.trim();

    const result = await parseCSV(csvWithWhitespace);

    // Verify whitespace is trimmed
    expect(result[0].date).toMatch(/^\d{4}-06-\d{2}$/);
    expect(result[0].amount).toBe(100.50);
    expect(result[0].description).toBe('Test Store');
  });

  describe('Auto-detection features', () => {
    it('should auto-detect ~|~ delimiter', async () => {
      const csvWithPipeDelimiter = `
Name~|~John Doe
Account~|~1234567890
Statement Date~|~23/04/2025
Transaction type~|~Customer~|~DATE~|~Description~|~AMT~|~Debit /Credit~|~REWARDS
Domestic~|~Test~|~25/12/2025~|~Test Store~|~100.50~|~~|~10
      `.trim();

      const result = await parseCSV(csvWithPipeDelimiter);

      expect(result.length).toBe(1);
      expect(result[0].amount).toBe(100.50);
      expect(result[0].description).toBe('Test Store');
    });

    it('should auto-detect ~ delimiter (new format)', async () => {
      const csvWithTildeDelimiter = `
Name~John Doe
Account~1234567890
Statement Date~23/04/2025
Transaction type~Customer~DATE~Description~AMT~Debit / Credit
Domestic~Test~25/12/2025~Test Store~100.50~
      `.trim();

      const result = await parseCSV(csvWithTildeDelimiter);

      expect(result.length).toBe(1);
      expect(result[0].amount).toBe(100.50);
      expect(result[0].description).toBe('Test Store');
    });

    it('should dynamically find header row regardless of position', async () => {
      // Header at line 3 (index 3)
      const csvWithEarlyHeader = `
Name~|~John Doe
Account~|~1234567890
Transaction type~|~Customer~|~DATE~|~Description~|~AMT~|~Debit /Credit~|~REWARDS
Domestic~|~Test~|~25/12/2025~|~Test Store~|~100.50~|~~|~10
      `.trim();

      const result = await parseCSV(csvWithEarlyHeader);
      expect(result.length).toBe(1);

      // Header at line 26 (index 26)
      const csvWithLateHeader = `
${Array(25).fill('metadata~|~row').join('\n')}
Transaction type~|~Customer~|~DATE~|~Description~|~AMT~|~Debit /Credit~|~REWARDS
Domestic~|~Test~|~26/12/2025~|~Another Store~|~200.00~|~~|~20
      `.trim();

      const result2 = await parseCSV(csvWithLateHeader);
      expect(result2.length).toBe(1);
      expect(result2[0].amount).toBe(200.00);
    });

    it('should handle both "Debit /Credit" and "Debit / Credit" column names', async () => {
      // Old format: "Debit /Credit" (no space before slash)
      const csvOldFormat = `
Transaction type~|~Customer~|~DATE~|~Description~|~AMT~|~Debit /Credit~|~REWARDS
Domestic~|~Test~|~25/12/2025~|~Debit TX~|~100.00~|~~|~10
Domestic~|~Test~|~26/12/2025~|~Credit TX~|~50.00~|~Cr~|~5
      `.trim();

      const result1 = await parseCSV(csvOldFormat);
      expect(result1.length).toBe(2);
      expect(result1[0].isCredit).toBe(false);
      expect(result1[1].isCredit).toBe(true);

      // New format: "Debit / Credit" (space before slash)
      const csvNewFormat = `
Transaction type~Customer~DATE~Description~AMT~Debit / Credit
Domestic~Test~25/12/2025~Debit TX~100.00~
Domestic~Test~26/12/2025~Credit TX~50.00~Cr
      `.trim();

      const result2 = await parseCSV(csvNewFormat);
      expect(result2.length).toBe(2);
      expect(result2[0].isCredit).toBe(false);
      expect(result2[1].isCredit).toBe(true);
    });

    it('should throw error when header row is not found', async () => {
      const csvWithoutHeader = `
Name~|~John Doe
Account~|~1234567890
Transaction~|~Some data
      `.trim();

      await expect(parseCSV(csvWithoutHeader)).rejects.toThrow(
        'Could not find header row with DATE and AMT columns'
      );
    });

    it('should handle case-insensitive header detection', async () => {
      // Header detection is case-insensitive, but column names must be uppercase for parsing
      const csvMixedCase = `
Name~|~John Doe
Transaction type~|~Customer~|~DATE~|~Description~|~AMT~|~Debit /Credit~|~REWARDS
Domestic~|~Test~|~25/12/2025~|~Test Store~|~100.50~|~~|~10
      `.trim();

      const result = await parseCSV(csvMixedCase);
      expect(result.length).toBe(1);
      expect(result[0].amount).toBe(100.50);
    });

    it('should skip footer rows like "Closing Balance"', async () => {
      const csvWithFooter = `
Statement Date~|~23/04/2025
Transaction type~|~Customer~|~DATE~|~Description~|~AMT~|~Debit /Credit~|~REWARDS
Domestic~|~Test~|~25/12/2025~|~Valid TX~|~100.50~|~~|~10
~|~~|~~|~Closing Balance~|~1,234.56~|~~|~
      `.trim();

      const result = await parseCSV(csvWithFooter);

      // Should only include valid transaction, not the footer row
      expect(result.length).toBe(1);
      expect(result[0].description).toBe('Valid TX');
      expect(result[0].amount).toBe(100.50);
    });
  });

  describe('extractStatementMetadata', () => {
    it('should extract statement date from metadata section', () => {
      const fileContent = `
Name~|~John Doe
Account~|~1234567890
Statement Date~|~23/04/2025
Transaction type~|~Customer~|~DATE~|~Description~|~AMT~|~Debit /Credit~|~REWARDS
Domestic~|~Test~|~25/12/2025~|~Test Store~|~100.50~|~~|~10
      `.trim();

      const headerIndex = 3; // "Transaction type" row
      const metadata = extractStatementMetadata(fileContent, headerIndex);

      expect(metadata.statementDate).toBe('23/04/2025');
    });

    it('should handle new format statement date', () => {
      const fileContent = `
Name~John Doe
Account~1234567890
Statement Date~23/04/2025
Transaction type~Customer~DATE~Description~AMT~Debit / Credit
Domestic~Test~25/12/2025~Test Store~100.50~
      `.trim();

      const headerIndex = 3;
      const metadata = extractStatementMetadata(fileContent, headerIndex);

      expect(metadata.statementDate).toBe('23/04/2025');
    });

    it('should return "Unknown" when statement date not found', () => {
      const fileContent = `
Name~|~John Doe
Account~|~1234567890
Transaction type~|~Customer~|~DATE~|~Description~|~AMT~|~Debit /Credit~|~REWARDS
Domestic~|~Test~|~25/12/2025~|~Test Store~|~100.50~|~~|~10
      `.trim();

      const headerIndex = 2;
      const metadata = extractStatementMetadata(fileContent, headerIndex);

      expect(metadata.statementDate).toBe('Unknown');
    });

    it('should handle different date formats in statement date line', () => {
      const fileContent = `
Name~|~John Doe
Statement Date~|~01/01/2025
Transaction type~|~Customer~|~DATE~|~Description~|~AMT~|~Debit /Credit
      `.trim();

      const headerIndex = 2;
      const metadata = extractStatementMetadata(fileContent, headerIndex);

      expect(metadata.statementDate).toBe('01/01/2025');
    });
  });
});
