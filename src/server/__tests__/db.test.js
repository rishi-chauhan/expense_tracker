import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Database } from 'bun:sqlite';

// Use in-memory database for tests
let testDb;

// Database functions that will use testDb instead of the real db
let getAllTransactions, getAllStatements, insertStatement, insertTransaction;
let checkDuplicateStatement, deleteStatement, getStatistics;

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

  // Create indexes
  testDb.run('CREATE INDEX idx_transactions_date ON transactions(date)');
  testDb.run('CREATE INDEX idx_transactions_hash ON transactions(tx_hash)');
  testDb.run('CREATE INDEX idx_statements_hash ON statements(file_hash)');

  // Define test functions using testDb
  getAllTransactions = () => {
    const query = testDb.query('SELECT * FROM transactions ORDER BY date DESC');
    return query.all();
  };

  getAllStatements = () => {
    const query = testDb.query(`
      SELECT
        s.*,
        COUNT(t.id) as transaction_count
      FROM statements s
      LEFT JOIN transactions t ON s.id = t.statement_id
      GROUP BY s.id
      ORDER BY s.uploaded_at DESC
    `);
    return query.all();
  };

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

  deleteStatement = (statementId) => {
    const query = testDb.query('DELETE FROM statements WHERE id = ?');
    const result = query.run(statementId);
    return result.changes;
  };

  getStatistics = () => {
    const totalTransactionsQuery = testDb.query('SELECT COUNT(*) as count FROM transactions');
    const totalStatementsQuery = testDb.query('SELECT COUNT(*) as count FROM statements');
    const totalDebitsQuery = testDb.query('SELECT SUM(amount) as sum FROM transactions WHERE is_credit = 0');
    const totalCreditsQuery = testDb.query('SELECT SUM(amount) as sum FROM transactions WHERE is_credit = 1');

    return {
      totalTransactions: totalTransactionsQuery.get().count,
      totalStatements: totalStatementsQuery.get().count,
      totalDebits: totalDebitsQuery.get().sum || 0,
      totalCredits: totalCreditsQuery.get().sum || 0
    };
  };
});

afterEach(() => {
  testDb.close();
});

describe('Database Schema', () => {
  it('should create statements table with correct columns', () => {
    const result = testDb.query("PRAGMA table_info(statements)").all();
    const columnNames = result.map(col => col.name);

    expect(columnNames).toContain('id');
    expect(columnNames).toContain('file_name');
    expect(columnNames).toContain('file_hash');
    expect(columnNames).toContain('period_start');
    expect(columnNames).toContain('period_end');
    expect(columnNames).toContain('row_count');
    expect(columnNames).toContain('uploaded_at');
  });

  it('should create transactions table with correct columns', () => {
    const result = testDb.query("PRAGMA table_info(transactions)").all();
    const columnNames = result.map(col => col.name);

    expect(columnNames).toContain('id');
    expect(columnNames).toContain('tx_hash');
    expect(columnNames).toContain('date');
    expect(columnNames).toContain('amount');
    expect(columnNames).toContain('description');
    expect(columnNames).toContain('is_credit');
    expect(columnNames).toContain('type');
    expect(columnNames).toContain('statement_id');
    expect(columnNames).toContain('uploaded_at');
  });

  it('should create transactions table with foreign key to statements', () => {
    const result = testDb.query("PRAGMA foreign_key_list(transactions)").all();

    expect(result.length).toBeGreaterThan(0);
    expect(result[0].table).toBe('statements');
    expect(result[0].on_delete).toBe('CASCADE');
  });

  it('should create indexes on hash columns', () => {
    const result = testDb.query("SELECT name FROM sqlite_master WHERE type='index'").all();
    const indexNames = result.map(idx => idx.name);

    expect(indexNames).toContain('idx_transactions_hash');
    expect(indexNames).toContain('idx_statements_hash');
    expect(indexNames).toContain('idx_transactions_date');
  });
});

describe('insertStatement', () => {
  it('should insert statement and return ID', () => {
    const stmtId = insertStatement(
      'test.csv',
      'hash123',
      '2025-01-01',
      '2025-01-31',
      10
    );

    expect(stmtId).toBeTypeOf('number');
    expect(stmtId).toBeGreaterThan(0);
  });

  it('should enforce unique file_hash constraint', () => {
    insertStatement('test1.csv', 'hash123', '2025-01-01', '2025-01-31', 10);

    expect(() => {
      insertStatement('test2.csv', 'hash123', '2025-02-01', '2025-02-28', 10);
    }).toThrow();
  });

  it('should store all statement fields correctly', () => {
    const stmtId = insertStatement(
      'test.csv',
      'hash456',
      '2025-01-01',
      '2025-01-31',
      25
    );

    const stmt = testDb.query('SELECT * FROM statements WHERE id = ?').get(stmtId);

    expect(stmt.file_name).toBe('test.csv');
    expect(stmt.file_hash).toBe('hash456');
    expect(stmt.period_start).toBe('2025-01-01');
    expect(stmt.period_end).toBe('2025-01-31');
    expect(stmt.row_count).toBe(25);
    expect(stmt.uploaded_at).toBeTruthy();
  });
});

describe('insertTransaction', () => {
  it('should insert transaction and link to statement', () => {
    const stmtId = insertStatement('test.csv', 'hash123', '2025-01-01', '2025-01-31', 1);

    const changes = insertTransaction(
      'txhash123',
      '2025-01-15',
      100.50,
      'Test Store',
      false,
      'Debit',
      stmtId
    );

    expect(changes).toBe(1);
  });

  it('should enforce unique tx_hash constraint (deduplication)', () => {
    const stmtId = insertStatement('test.csv', 'hash123', '2025-01-01', '2025-01-31', 2);

    insertTransaction('txhash123', '2025-01-15', 100.50, 'Test', false, 'Debit', stmtId);

    // Try to insert duplicate transaction
    const changes = insertTransaction('txhash123', '2025-01-15', 100.50, 'Test', false, 'Debit', stmtId);

    expect(changes).toBe(0); // INSERT OR IGNORE should skip
  });

  it('should store transaction fields correctly', () => {
    const stmtId = insertStatement('test.csv', 'hash123', '2025-01-01', '2025-01-31', 1);

    insertTransaction('txhash456', '2025-01-20', 250.75, 'Restaurant', true, 'Credit', stmtId);

    const tx = testDb.query('SELECT * FROM transactions WHERE tx_hash = ?').get('txhash456');

    expect(tx.tx_hash).toBe('txhash456');
    expect(tx.date).toBe('2025-01-20');
    expect(tx.amount).toBe(250.75);
    expect(tx.description).toBe('Restaurant');
    expect(tx.is_credit).toBe(1);
    expect(tx.type).toBe('Credit');
    expect(tx.statement_id).toBe(stmtId);
    expect(tx.uploaded_at).toBeTruthy();
  });

  it('should store is_credit as 0 for debits', () => {
    const stmtId = insertStatement('test.csv', 'hash123', '2025-01-01', '2025-01-31', 1);

    insertTransaction('txhash789', '2025-01-20', 100, 'Store', false, 'Debit', stmtId);

    const tx = testDb.query('SELECT * FROM transactions WHERE tx_hash = ?').get('txhash789');
    expect(tx.is_credit).toBe(0);
  });
});

describe('checkDuplicateStatement', () => {
  it('should return null/undefined for non-existent statement', () => {
    const result = checkDuplicateStatement('nonexistent');
    expect(result).toBeFalsy();
  });

  it('should return statement if file_hash exists', () => {
    insertStatement('test.csv', 'hash123', '2025-01-01', '2025-01-31', 10);

    const result = checkDuplicateStatement('hash123');

    expect(result).toBeTruthy();
    expect(result.file_name).toBe('test.csv');
    expect(result.file_hash).toBe('hash123');
  });
});

describe('getAllTransactions', () => {
  it('should return empty array when no transactions', () => {
    const result = getAllTransactions();
    expect(result).toEqual([]);
  });

  it('should return all transactions sorted by date DESC', () => {
    const stmtId = insertStatement('test.csv', 'hash123', '2025-01-01', '2025-01-31', 3);

    insertTransaction('tx1', '2025-01-10', 100, 'Store A', false, 'Debit', stmtId);
    insertTransaction('tx2', '2025-01-20', 200, 'Store B', false, 'Debit', stmtId);
    insertTransaction('tx3', '2025-01-05', 300, 'Store C', false, 'Debit', stmtId);

    const result = getAllTransactions();

    expect(result).toHaveLength(3);
    expect(result[0].date).toBe('2025-01-20'); // Most recent first
    expect(result[1].date).toBe('2025-01-10');
    expect(result[2].date).toBe('2025-01-05');
  });
});

describe('getAllStatements', () => {
  it('should return empty array when no statements', () => {
    const result = getAllStatements();
    expect(result).toEqual([]);
  });

  it('should return statements with transaction count', () => {
    const stmtId1 = insertStatement('test1.csv', 'hash1', '2025-01-01', '2025-01-31', 2);
    const stmtId2 = insertStatement('test2.csv', 'hash2', '2025-02-01', '2025-02-28', 1);

    insertTransaction('tx1', '2025-01-10', 100, 'Store A', false, 'Debit', stmtId1);
    insertTransaction('tx2', '2025-01-20', 200, 'Store B', false, 'Debit', stmtId1);
    insertTransaction('tx3', '2025-02-10', 300, 'Store C', false, 'Debit', stmtId2);

    const result = getAllStatements();

    expect(result).toHaveLength(2);

    const stmt1 = result.find(s => s.file_name === 'test1.csv');
    const stmt2 = result.find(s => s.file_name === 'test2.csv');

    expect(stmt1.transaction_count).toBe(2);
    expect(stmt2.transaction_count).toBe(1);
  });

  it('should include statement metadata', () => {
    insertStatement('test.csv', 'hash1', '2025-01-01', '2025-01-31', 5);

    const result = getAllStatements();

    expect(result).toHaveLength(1);
    expect(result[0].file_name).toBe('test.csv');
    expect(result[0].transaction_count).toBe(0);
  });
});

describe('deleteStatement', () => {
  it('should delete statement and CASCADE to transactions', () => {
    const stmtId = insertStatement('test.csv', 'hash123', '2025-01-01', '2025-01-31', 2);
    insertTransaction('tx1', '2025-01-10', 100, 'Test', false, 'Debit', stmtId);
    insertTransaction('tx2', '2025-01-15', 200, 'Test2', false, 'Debit', stmtId);

    const changes = deleteStatement(stmtId);

    expect(changes).toBeGreaterThan(0);

    // Verify transactions were also deleted (CASCADE)
    const transactions = getAllTransactions();
    expect(transactions).toHaveLength(0);
  });

  it('should return 0 for non-existent statement', () => {
    const changes = deleteStatement(999);
    expect(changes).toBe(0);
  });

  it('should not affect other statements', () => {
    const stmtId1 = insertStatement('test1.csv', 'hash1', '2025-01-01', '2025-01-31', 1);
    const stmtId2 = insertStatement('test2.csv', 'hash2', '2025-02-01', '2025-02-28', 1);

    insertTransaction('tx1', '2025-01-10', 100, 'Store A', false, 'Debit', stmtId1);
    insertTransaction('tx2', '2025-02-10', 200, 'Store B', false, 'Debit', stmtId2);

    deleteStatement(stmtId1);

    const statements = getAllStatements();
    expect(statements).toHaveLength(1);
    expect(statements[0].file_name).toBe('test2.csv');

    const transactions = getAllTransactions();
    expect(transactions).toHaveLength(1);
    expect(transactions[0].description).toBe('Store B');
  });
});

describe('getStatistics', () => {
  it('should return zeros when database is empty', () => {
    const stats = getStatistics();

    expect(stats.totalTransactions).toBe(0);
    expect(stats.totalStatements).toBe(0);
    expect(stats.totalDebits).toBe(0);
    expect(stats.totalCredits).toBe(0);
  });

  it('should calculate correct statistics', () => {
    const stmtId = insertStatement('test.csv', 'hash123', '2025-01-01', '2025-01-31', 4);

    insertTransaction('tx1', '2025-01-10', 100, 'Debit1', false, 'Debit', stmtId);
    insertTransaction('tx2', '2025-01-15', 200, 'Debit2', false, 'Debit', stmtId);
    insertTransaction('tx3', '2025-01-20', 50, 'Credit1', true, 'Credit', stmtId);
    insertTransaction('tx4', '2025-01-25', 25, 'Credit2', true, 'Credit', stmtId);

    const stats = getStatistics();

    expect(stats.totalTransactions).toBe(4);
    expect(stats.totalStatements).toBe(1);
    expect(stats.totalDebits).toBe(300);
    expect(stats.totalCredits).toBe(75);
  });

  it('should handle multiple statements', () => {
    const stmtId1 = insertStatement('test1.csv', 'hash1', '2025-01-01', '2025-01-31', 1);
    const stmtId2 = insertStatement('test2.csv', 'hash2', '2025-02-01', '2025-02-28', 1);

    insertTransaction('tx1', '2025-01-10', 100, 'Test1', false, 'Debit', stmtId1);
    insertTransaction('tx2', '2025-02-10', 200, 'Test2', false, 'Debit', stmtId2);

    const stats = getStatistics();

    expect(stats.totalTransactions).toBe(2);
    expect(stats.totalStatements).toBe(2);
    expect(stats.totalDebits).toBe(300);
  });
});
