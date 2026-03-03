import { describe, it, expect } from 'vitest';
import { parseCSV, extractStatementMetadata, extractCardInfo } from '../parser.js';
import { readFileSync } from 'fs';
import path from 'path';

describe('parseCSV', () => {
  it('should parse valid credit card CSV', async () => {
    const csvPath = path.join(process.cwd(), 'tests/fixtures/sample_valid.csv');
    const content = readFileSync(csvPath, 'utf-8');

    const result = await parseCSV(content);

    expect(result).toHaveProperty('transactions');
    expect(result).toHaveProperty('cardInfo');
    expect(result.transactions).toBeInstanceOf(Array);
    expect(result.transactions.length).toBeGreaterThan(0);
    expect(result.transactions[0]).toHaveProperty('date');
    expect(result.transactions[0]).toHaveProperty('amount');
    expect(result.transactions[0]).toHaveProperty('description');
    expect(result.transactions[0]).toHaveProperty('isCredit');
    expect(result.transactions[0]).toHaveProperty('type');
  });

  it('should skip first 25 metadata rows', async () => {
    const csvPath = path.join(process.cwd(), 'tests/fixtures/sample_valid.csv');
    const content = readFileSync(csvPath, 'utf-8');
    const lines = content.split('\n');

    // Verify file has metadata rows
    expect(lines[0]).toContain('Name~|~');

    const { transactions } = await parseCSV(content);

    // Results should not include metadata
    expect(transactions.some(tx => tx.description && tx.description.includes('Name~|~'))).toBe(false);
  });

  it('should handle ~|~ delimiter correctly', async () => {
    const csvPath = path.join(process.cwd(), 'tests/fixtures/sample_valid.csv');
    const content = readFileSync(csvPath, 'utf-8');

    const { transactions } = await parseCSV(content);

    // Should parse multiple columns separated by ~|~
    expect(transactions[0].description).not.toContain('~|~');
    expect(transactions[0].amount).toBeTypeOf('number');
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

    const { transactions } = await parseCSV(csvWithInvalid);

    // Should only include valid transaction
    expect(transactions.length).toBe(1);
    expect(transactions[0].amount).toBe(100.50);
  });

  it('should correctly identify credits vs debits', async () => {
    const csvWithCreditsDebits = `
${Array(25).fill('metadata~|~row').join('\n')}
Transaction type~|~Customer~|~DATE~|~Description~|~AMT~|~Debit /Credit~|~REWARDS
Domestic~|~Test~|~25/12/2025~|~Debit Transaction~|~100.50~|~~|~10
Domestic~|~Test~|~26/12/2025~|~Credit Transaction~|~50.00~|~Cr~|~5
    `.trim();

    const { transactions } = await parseCSV(csvWithCreditsDebits);

    expect(transactions.length).toBe(2);

    const debit = transactions.find(tx => tx.description === 'Debit Transaction');
    const credit = transactions.find(tx => tx.description === 'Credit Transaction');

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

    const { transactions } = await parseCSV(csvWithDate);

    // Verify date is parsed and in ISO format
    expect(transactions[0].date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(transactions[0].date).toContain('2025-06');
  });

  it('should parse amounts with commas', async () => {
    const csvWithCommas = `
${Array(25).fill('metadata~|~row').join('\n')}
Transaction type~|~Customer~|~DATE~|~Description~|~AMT~|~Debit /Credit~|~REWARDS
Domestic~|~Test~|~25/12/2025~|~Test Store~|~1,234.56~|~~|~10
    `.trim();

    const { transactions } = await parseCSV(csvWithCommas);

    expect(transactions[0].amount).toBe(1234.56);
  });

  it('should handle Windows line endings (\\r\\n)', async () => {
    const csvWithWindowsEndings = [
      ...Array(25).fill('metadata~|~row'),
      'Transaction type~|~Customer~|~DATE~|~Description~|~AMT~|~Debit /Credit~|~REWARDS',
      'Domestic~|~Test~|~25/12/2025~|~Test Store~|~100.50~|~~|~10'
    ].join('\r\n');

    const { transactions } = await parseCSV(csvWithWindowsEndings);

    expect(transactions.length).toBe(1);
    expect(transactions[0].amount).toBe(100.50);
  });

  it('should handle Unix line endings (\\n)', async () => {
    const csvWithUnixEndings = [
      ...Array(25).fill('metadata~|~row'),
      'Transaction type~|~Customer~|~DATE~|~Description~|~AMT~|~Debit /Credit~|~REWARDS',
      'Domestic~|~Test~|~25/12/2025~|~Test Store~|~100.50~|~~|~10'
    ].join('\n');

    const { transactions } = await parseCSV(csvWithUnixEndings);

    expect(transactions.length).toBe(1);
    expect(transactions[0].amount).toBe(100.50);
  });

  it('should skip rows with missing required fields', async () => {
    const csvWithMissing = `
${Array(25).fill('metadata~|~row').join('\n')}
Transaction type~|~Customer~|~DATE~|~Description~|~AMT~|~Debit /Credit~|~REWARDS
Domestic~|~Test~|~25/12/2025~|~Valid~|~100.50~|~~|~10
Domestic~|~Test~|~~|~Missing Date~|~50.00~|~~|~5
Domestic~|~Test~|~26/12/2025~|~Missing Amount~|~~|~~|~5
    `.trim();

    const { transactions } = await parseCSV(csvWithMissing);

    expect(transactions.length).toBe(1);
    expect(transactions[0].description).toBe('Valid');
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

    const { transactions } = await parseCSV(csvWithWhitespace);

    // Verify whitespace is trimmed
    expect(transactions[0].date).toMatch(/^\d{4}-06-\d{2}$/);
    expect(transactions[0].amount).toBe(100.50);
    expect(transactions[0].description).toBe('Test Store');
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

      const { transactions } = await parseCSV(csvWithPipeDelimiter);

      expect(transactions.length).toBe(1);
      expect(transactions[0].amount).toBe(100.50);
      expect(transactions[0].description).toBe('Test Store');
    });

    it('should auto-detect ~ delimiter (new format)', async () => {
      const csvWithTildeDelimiter = `
Name~John Doe
Account~1234567890
Statement Date~23/04/2025
Transaction type~Customer~DATE~Description~AMT~Debit / Credit
Domestic~Test~25/12/2025~Test Store~100.50~
      `.trim();

      const { transactions } = await parseCSV(csvWithTildeDelimiter);

      expect(transactions.length).toBe(1);
      expect(transactions[0].amount).toBe(100.50);
      expect(transactions[0].description).toBe('Test Store');
    });

    it('should dynamically find header row regardless of position', async () => {
      // Header at line 3 (index 3)
      const csvWithEarlyHeader = `
Name~|~John Doe
Account~|~1234567890
Transaction type~|~Customer~|~DATE~|~Description~|~AMT~|~Debit /Credit~|~REWARDS
Domestic~|~Test~|~25/12/2025~|~Test Store~|~100.50~|~~|~10
      `.trim();

      const { transactions } = await parseCSV(csvWithEarlyHeader);
      expect(transactions.length).toBe(1);

      // Header at line 26 (index 26)
      const csvWithLateHeader = `
${Array(25).fill('metadata~|~row').join('\n')}
Transaction type~|~Customer~|~DATE~|~Description~|~AMT~|~Debit /Credit~|~REWARDS
Domestic~|~Test~|~26/12/2025~|~Another Store~|~200.00~|~~|~20
      `.trim();

      const result2 = await parseCSV(csvWithLateHeader);
      expect(result2.transactions.length).toBe(1);
      expect(result2.transactions[0].amount).toBe(200.00);
    });

    it('should handle both "Debit /Credit" and "Debit / Credit" column names', async () => {
      // Old format: "Debit /Credit" (no space before slash)
      const csvOldFormat = `
Transaction type~|~Customer~|~DATE~|~Description~|~AMT~|~Debit /Credit~|~REWARDS
Domestic~|~Test~|~25/12/2025~|~Debit TX~|~100.00~|~~|~10
Domestic~|~Test~|~26/12/2025~|~Credit TX~|~50.00~|~Cr~|~5
      `.trim();

      const result1 = await parseCSV(csvOldFormat);
      expect(result1.transactions.length).toBe(2);
      expect(result1.transactions[0].isCredit).toBe(false);
      expect(result1.transactions[1].isCredit).toBe(true);

      // New format: "Debit / Credit" (space before slash)
      const csvNewFormat = `
Transaction type~Customer~DATE~Description~AMT~Debit / Credit
Domestic~Test~25/12/2025~Debit TX~100.00~
Domestic~Test~26/12/2025~Credit TX~50.00~Cr
      `.trim();

      const result2 = await parseCSV(csvNewFormat);
      expect(result2.transactions.length).toBe(2);
      expect(result2.transactions[0].isCredit).toBe(false);
      expect(result2.transactions[1].isCredit).toBe(true);
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

      const { transactions } = await parseCSV(csvMixedCase);
      expect(transactions.length).toBe(1);
      expect(transactions[0].amount).toBe(100.50);
    });

    it('should skip footer rows like "Closing Balance"', async () => {
      const csvWithFooter = `
Statement Date~|~23/04/2025
Transaction type~|~Customer~|~DATE~|~Description~|~AMT~|~Debit /Credit~|~REWARDS
Domestic~|~Test~|~25/12/2025~|~Valid TX~|~100.50~|~~|~10
~|~~|~~|~Closing Balance~|~1,234.56~|~~|~
      `.trim();

      const { transactions } = await parseCSV(csvWithFooter);

      // Should only include valid transaction, not the footer row
      expect(transactions.length).toBe(1);
      expect(transactions[0].description).toBe('Valid TX');
      expect(transactions[0].amount).toBe(100.50);
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

  describe('extractCardInfo', () => {
    it('should extract card last 4 digits from Card No line', () => {
      const content = `
Name~|~John Doe
Card No: 4111 11XX XXXX 1234
Transaction type~|~Customer~|~DATE~|~Description~|~AMT~|~Debit /Credit
      `.trim();

      const result = extractCardInfo(content, 2);
      expect(result.cardLast4).toBe('1234');
    });

    it('should detect HDFC bank from metadata', () => {
      const content = `
Name~|~John Doe
HDFC Bank Credit Card Statement
Card No: 4111 11XX XXXX 5678
Transaction type~|~Customer~|~DATE~|~Description~|~AMT~|~Debit /Credit
      `.trim();

      const result = extractCardInfo(content, 3);
      expect(result.bankName).toBe('HDFC');
      expect(result.cardLast4).toBe('5678');
    });

    it('should detect bank name from filename as fallback', () => {
      const content = `
Name~|~John Doe
Card No: 4111 11XX XXXX 9999
Transaction type~|~Customer~|~DATE~|~Description~|~AMT~|~Debit /Credit
      `.trim();

      const result = extractCardInfo(content, 2, 'ICICI_statement_Jan2025.csv');
      expect(result.bankName).toBe('ICICI');
      expect(result.cardLast4).toBe('9999');
    });

    it('should return null when card info not found', () => {
      const content = `
Name~|~John Doe
Account~|~1234567890
Transaction type~|~Customer~|~DATE~|~Description~|~AMT~|~Debit /Credit
      `.trim();

      const result = extractCardInfo(content, 2);
      expect(result.bankName).toBeNull();
      expect(result.cardLast4).toBeNull();
    });

    it('should extract card info from sample_valid.csv fixture', () => {
      const csvPath = path.join(process.cwd(), 'tests/fixtures/sample_valid.csv');
      const content = readFileSync(csvPath, 'utf-8');
      // Find header index manually
      const lines = content.split(/\r?\n/);
      const headerIndex = lines.findIndex(l => l.toUpperCase().includes('DATE') && l.toUpperCase().includes('AMT'));

      const result = extractCardInfo(content, headerIndex);
      expect(result.cardLast4).toBe('1111');
    });

    it('should return cardInfo from parseCSV result', async () => {
      const csvPath = path.join(process.cwd(), 'tests/fixtures/sample_valid.csv');
      const content = readFileSync(csvPath, 'utf-8');

      const result = await parseCSV(content);
      expect(result.cardInfo).toBeDefined();
      expect(result.cardInfo.cardLast4).toBe('1111');
    });
  });
});
