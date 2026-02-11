import { Database } from 'bun:sqlite';
import path from 'path';

// Initialize SQLite database
const dbPath = path.join(process.cwd(), 'data', 'expenses.db');
export const db = new Database(dbPath, { create: true });

// Enable foreign keys
db.run('PRAGMA foreign_keys = ON');

/**
 * Initialize database schema
 */
export function initializeDatabase() {
  // Create statements table
  db.run(`
    CREATE TABLE IF NOT EXISTS statements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      file_name TEXT NOT NULL,
      file_hash TEXT UNIQUE NOT NULL,
      period_start TEXT NOT NULL,
      period_end TEXT NOT NULL,
      row_count INTEGER NOT NULL,
      uploaded_at TEXT NOT NULL
    )
  `);

  // Create transactions table
  db.run(`
    CREATE TABLE IF NOT EXISTS transactions (
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

  // Create indexes for performance
  db.run('CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date)');
  db.run('CREATE INDEX IF NOT EXISTS idx_transactions_hash ON transactions(tx_hash)');
  db.run('CREATE INDEX IF NOT EXISTS idx_statements_hash ON statements(file_hash)');

  console.log('✅ Database initialized at:', dbPath);
}

/**
 * Get all transactions sorted by date descending
 */
export function getAllTransactions() {
  const query = db.query('SELECT * FROM transactions ORDER BY date DESC');
  return query.all();
}

/**
 * Get all statements with metadata
 */
export function getAllStatements() {
  const query = db.query(`
    SELECT
      s.*,
      COUNT(t.id) as transaction_count
    FROM statements s
    LEFT JOIN transactions t ON s.id = t.statement_id
    GROUP BY s.id
    ORDER BY s.uploaded_at DESC
  `);
  return query.all();
}

/**
 * Check if a statement with the given file hash already exists
 */
export function checkDuplicateStatement(fileHash) {
  const query = db.query('SELECT * FROM statements WHERE file_hash = ?');
  return query.get(fileHash);
}

/**
 * Insert a new statement
 * Returns the new statement ID
 */
export function insertStatement(fileName, fileHash, periodStart, periodEnd, rowCount) {
  const uploadedAt = new Date().toISOString();
  const query = db.query(`
    INSERT INTO statements (file_name, file_hash, period_start, period_end, row_count, uploaded_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const result = query.run(fileName, fileHash, periodStart, periodEnd, rowCount, uploadedAt);
  return result.lastInsertRowid;
}

/**
 * Insert a new transaction (uses INSERT OR IGNORE for deduplication)
 * Returns the number of rows inserted (0 if duplicate, 1 if new)
 */
export function insertTransaction(txHash, date, amount, description, isCredit, type, statementId) {
  const uploadedAt = new Date().toISOString();
  const query = db.query(`
    INSERT OR IGNORE INTO transactions
    (tx_hash, date, amount, description, is_credit, type, statement_id, uploaded_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const result = query.run(txHash, date, amount, description, isCredit ? 1 : 0, type, statementId, uploadedAt);
  return result.changes;
}

/**
 * Delete a statement and all its transactions (CASCADE)
 */
export function deleteStatement(statementId) {
  const query = db.query('DELETE FROM statements WHERE id = ?');
  const result = query.run(statementId);
  return result.changes;
}

/**
 * Get statistics about stored data
 */
export function getStatistics() {
  const totalTransactionsQuery = db.query('SELECT COUNT(*) as count FROM transactions');
  const totalStatementsQuery = db.query('SELECT COUNT(*) as count FROM statements');
  const totalDebitsQuery = db.query('SELECT SUM(amount) as sum FROM transactions WHERE is_credit = 0');
  const totalCreditsQuery = db.query('SELECT SUM(amount) as sum FROM transactions WHERE is_credit = 1');

  return {
    totalTransactions: totalTransactionsQuery.get().count,
    totalStatements: totalStatementsQuery.get().count,
    totalDebits: totalDebitsQuery.get().sum || 0,
    totalCredits: totalCreditsQuery.get().sum || 0
  };
}
