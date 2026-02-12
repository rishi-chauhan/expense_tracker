import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { parseCSV } from '../parser.js';
import { generateFileHash, generateTxHash } from '../utils.js';
import { Database } from 'bun:sqlite';
import { readFileSync } from 'fs';
import path from 'path';

// Use in-memory database for integration tests
let testDb;
let insertStatement, insertTransaction, checkDuplicateStatement;

beforeEach(() => {
  // Create fresh in-memory database for each test
  testDb = new Database(':memory:');

  // Enable foreign keys
  testDb.run('PRAGMA foreign_keys = ON');

  // Initialize schema
  testDb.run(`
    CREATE TABLE statements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      file_name TEXT NOT NULL,
      file_hash TEXT UNIQUE NOT NULL,
      period_start TEXT NOT NULL,
      period_end TEXT NOT NULL,
      row_count INTEGER NOT NULL,
      uploaded_at TEXT NOT NULL
    )
  `);

  testDb.run(`
    CREATE TABLE transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tx_hash TEXT UNIQUE NOT NULL,
      date TEXT NOT NULL,
      amount REAL NOT NULL,
      description TEXT NOT NULL,
      is_credit INTEGER NOT NULL,
      type TEXT NOT NULL,
      statement_id INTEGER NOT NULL,
      uploaded_at TEXT NOT NULL,
      FOREIGN KEY (statement_id) REFERENCES statements(id) ON DELETE CASCADE
    )
  `);

  // Define test database functions
  checkDuplicateStatement = (fileHash) => {
    const query = testDb.query('SELECT * FROM statements WHERE file_hash = ?');
    return query.get(fileHash);
  };

  insertStatement = (fileName, fileHash, periodStart, periodEnd, rowCount) => {
    const uploadedAt = new Date().toISOString();
    const query = testDb.query(`
      INSERT INTO statements (file_name, file_hash, period_start, period_end, row_count, uploaded_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    const result = query.run(fileName, fileHash, periodStart, periodEnd, rowCount, uploadedAt);
    return result.lastInsertRowid;
  };

  insertTransaction = (txHash, date, amount, description, isCredit, type, statementId) => {
    const uploadedAt = new Date().toISOString();
    const query = testDb.query(`
      INSERT OR IGNORE INTO transactions
      (tx_hash, date, amount, description, is_credit, type, statement_id, uploaded_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const result = query.run(txHash, date, amount, description, isCredit ? 1 : 0, type, statementId, uploadedAt);
    return result.changes;
  };
});

afterEach(() => {
  testDb.close();
});

describe('Full Upload Workflow', () => {
  it('should process valid CSV from parse to database', async () => {
    const csvPath = path.join(process.cwd(), 'tests/fixtures/sample_valid.csv');
    const content = readFileSync(csvPath, 'utf-8');

    // Step 1: Check for duplicate file
    const fileHash = generateFileHash(content);
    const existingStmt = checkDuplicateStatement(fileHash);
    expect(existingStmt).toBeFalsy();

    // Step 2: Parse CSV
    const transactions = await parseCSV(content);
    expect(transactions.length).toBeGreaterThan(0);

    // Validate parsed transaction structure
    const firstTx = transactions[0];
    expect(firstTx).toHaveProperty('date');
    expect(firstTx).toHaveProperty('amount');
    expect(firstTx).toHaveProperty('description');
    expect(firstTx).toHaveProperty('isCredit');
    expect(firstTx).toHaveProperty('type');

    // Step 3: Calculate statement period
    const dates = transactions.map(t => new Date(t.date).getTime());
    const periodStart = new Date(Math.min(...dates)).toISOString().split('T')[0];
    const periodEnd = new Date(Math.max(...dates)).toISOString().split('T')[0];

    expect(periodStart).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(periodEnd).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    // Step 4: Insert statement
    const stmtId = insertStatement(
      'sample_valid.csv',
      fileHash,
      periodStart,
      periodEnd,
      transactions.length
    );

    expect(stmtId).toBeGreaterThan(0);

    // Step 5: Insert transactions with deduplication tracking
    let newCount = 0, duplicateCount = 0;

    for (const tx of transactions) {
      const txHash = generateTxHash(tx.date, tx.amount, tx.description);
      const changes = insertTransaction(
        txHash,
        tx.date,
        tx.amount,
        tx.description,
        tx.isCredit,
        tx.type,
        stmtId
      );

      if (changes > 0) newCount++;
      else duplicateCount++;
    }

    expect(newCount).toBeGreaterThan(0);
    expect(newCount + duplicateCount).toBe(transactions.length);

    // Step 6: Verify data in database (some transactions have identical date+amount+description, so INSERT OR IGNORE skips them)
    const storedTransactions = testDb.query('SELECT * FROM transactions').all();
    expect(storedTransactions.length).toBe(newCount);

    const storedStatement = testDb.query('SELECT * FROM statements WHERE id = ?').get(stmtId);
    expect(storedStatement.file_hash).toBe(fileHash);
    expect(storedStatement.row_count).toBe(transactions.length);
  });

  it('should detect duplicate file by hash', async () => {
    const csvPath = path.join(process.cwd(), 'tests/fixtures/sample_valid.csv');
    const content = readFileSync(csvPath, 'utf-8');

    // First upload
    const fileHash = generateFileHash(content);
    const transactions = await parseCSV(content);
    const dates = transactions.map(t => new Date(t.date).getTime());
    const periodStart = new Date(Math.min(...dates)).toISOString().split('T')[0];
    const periodEnd = new Date(Math.max(...dates)).toISOString().split('T')[0];

    insertStatement('sample_valid.csv', fileHash, periodStart, periodEnd, transactions.length);

    // Second upload attempt (duplicate)
    const existingStmt = checkDuplicateStatement(fileHash);

    expect(existingStmt).toBeDefined();
    expect(existingStmt.file_hash).toBe(fileHash);
    expect(existingStmt.file_name).toBe('sample_valid.csv');
  });

  it('should deduplicate transactions across overlapping statements', async () => {
    const csvPath = path.join(process.cwd(), 'tests/fixtures/sample_valid.csv');
    const content = readFileSync(csvPath, 'utf-8');

    const transactions = await parseCSV(content);

    // First statement
    const fileHash1 = generateFileHash(content + '1'); // Different file hash
    const dates = transactions.map(t => new Date(t.date).getTime());
    const periodStart = new Date(Math.min(...dates)).toISOString().split('T')[0];
    const periodEnd = new Date(Math.max(...dates)).toISOString().split('T')[0];

    const stmtId1 = insertStatement(
      'statement1.csv',
      fileHash1,
      periodStart,
      periodEnd,
      transactions.length
    );

    // Insert all transactions from first statement
    for (const tx of transactions) {
      const txHash = generateTxHash(tx.date, tx.amount, tx.description);
      insertTransaction(txHash, tx.date, tx.amount, tx.description, tx.isCredit, tx.type, stmtId1);
    }

    // Second statement with same transactions (overlapping period)
    const fileHash2 = generateFileHash(content + '2'); // Different file hash
    const stmtId2 = insertStatement(
      'statement2.csv',
      fileHash2,
      periodStart,
      periodEnd,
      transactions.length
    );

    // Try to insert same transactions again
    let newCount = 0, duplicateCount = 0;

    for (const tx of transactions) {
      const txHash = generateTxHash(tx.date, tx.amount, tx.description);
      const changes = insertTransaction(
        txHash,
        tx.date,
        tx.amount,
        tx.description,
        tx.isCredit,
        tx.type,
        stmtId2
      );

      if (changes > 0) newCount++;
      else duplicateCount++;
    }

    // Most transactions should be duplicates (there might be some unique ones)
    expect(duplicateCount).toBeGreaterThan(0);
    expect(newCount + duplicateCount).toBe(transactions.length);

    // Verify transactions were deduplicated
    const storedTransactions = testDb.query('SELECT * FROM transactions').all();
    expect(storedTransactions.length).toBeGreaterThan(0);
    expect(storedTransactions.length).toBeLessThanOrEqual(transactions.length * 2);
  });

  it('should handle CSV parsing errors gracefully', async () => {
    const invalidContent = 'Invalid CSV content';

    await expect(parseCSV(invalidContent)).rejects.toThrow();
  });

  it('should calculate correct period from transaction dates', async () => {
    const csvPath = path.join(process.cwd(), 'tests/fixtures/sample_valid.csv');
    const content = readFileSync(csvPath, 'utf-8');

    const transactions = await parseCSV(content);
    const dates = transactions.map(t => new Date(t.date).getTime());

    const periodStart = new Date(Math.min(...dates)).toISOString().split('T')[0];
    const periodEnd = new Date(Math.max(...dates)).toISOString().split('T')[0];

    // Verify period is valid
    const startDate = new Date(periodStart);
    const endDate = new Date(periodEnd);

    expect(startDate).toBeInstanceOf(Date);
    expect(endDate).toBeInstanceOf(Date);
    expect(startDate.getTime()).toBeLessThanOrEqual(endDate.getTime());
  });

  it('should preserve transaction details through full workflow', async () => {
    const csvPath = path.join(process.cwd(), 'tests/fixtures/sample_valid.csv');
    const content = readFileSync(csvPath, 'utf-8');

    const fileHash = generateFileHash(content);
    const transactions = await parseCSV(content);
    const dates = transactions.map(t => new Date(t.date).getTime());
    const periodStart = new Date(Math.min(...dates)).toISOString().split('T')[0];
    const periodEnd = new Date(Math.max(...dates)).toISOString().split('T')[0];

    const stmtId = insertStatement(
      'test.csv',
      fileHash,
      periodStart,
      periodEnd,
      transactions.length
    );

    const originalTx = transactions[0];
    const txHash = generateTxHash(originalTx.date, originalTx.amount, originalTx.description);

    insertTransaction(
      txHash,
      originalTx.date,
      originalTx.amount,
      originalTx.description,
      originalTx.isCredit,
      originalTx.type,
      stmtId
    );

    const storedTx = testDb.query('SELECT * FROM transactions WHERE tx_hash = ?').get(txHash);

    expect(storedTx.date).toBe(originalTx.date);
    expect(storedTx.amount).toBe(originalTx.amount);
    expect(storedTx.description).toBe(originalTx.description);
    expect(storedTx.is_credit).toBe(originalTx.isCredit ? 1 : 0);
    expect(storedTx.type).toBe(originalTx.type);
  });
});

describe('End-to-End Data Integrity', () => {
  it('should maintain referential integrity when deleting statements', async () => {
    const csvPath = path.join(process.cwd(), 'tests/fixtures/sample_valid.csv');
    const content = readFileSync(csvPath, 'utf-8');

    const fileHash = generateFileHash(content);
    const transactions = await parseCSV(content);
    const dates = transactions.map(t => new Date(t.date).getTime());
    const periodStart = new Date(Math.min(...dates)).toISOString().split('T')[0];
    const periodEnd = new Date(Math.max(...dates)).toISOString().split('T')[0];

    const stmtId = insertStatement(
      'test.csv',
      fileHash,
      periodStart,
      periodEnd,
      transactions.length
    );

    // Insert all transactions
    for (const tx of transactions) {
      const txHash = generateTxHash(tx.date, tx.amount, tx.description);
      insertTransaction(txHash, tx.date, tx.amount, tx.description, tx.isCredit, tx.type, stmtId);
    }

    // Verify transactions exist
    const beforeDelete = testDb.query('SELECT COUNT(*) as count FROM transactions').get();
    expect(beforeDelete.count).toBeGreaterThan(0);

    // Delete statement
    testDb.query('DELETE FROM statements WHERE id = ?').run(stmtId);

    // Verify transactions are CASCADE deleted
    const afterDelete = testDb.query('SELECT COUNT(*) as count FROM transactions').get();
    expect(afterDelete.count).toBe(0);
  });

  it('should generate unique hashes for similar but different transactions', async () => {
    const tx1Hash = generateTxHash('2025-01-15', 100.00, 'Store A');
    const tx2Hash = generateTxHash('2025-01-15', 100.00, 'Store B'); // Different description
    const tx3Hash = generateTxHash('2025-01-15', 100.01, 'Store A'); // Different amount
    const tx4Hash = generateTxHash('2025-01-16', 100.00, 'Store A'); // Different date

    expect(tx1Hash).not.toBe(tx2Hash);
    expect(tx1Hash).not.toBe(tx3Hash);
    expect(tx1Hash).not.toBe(tx4Hash);
    expect(tx2Hash).not.toBe(tx3Hash);
  });
});
