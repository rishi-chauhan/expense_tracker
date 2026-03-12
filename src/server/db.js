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
  // Create cards table
  db.run(`
    CREATE TABLE IF NOT EXISTS cards (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bank_name TEXT NOT NULL,
      card_last4 TEXT NOT NULL,
      card_label TEXT NOT NULL,
      created_at TEXT NOT NULL,
      UNIQUE(bank_name, card_last4)
    )
  `);

  // Create statements table
  db.run(`
    CREATE TABLE IF NOT EXISTS statements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      file_name TEXT NOT NULL,
      file_hash TEXT UNIQUE NOT NULL,
      period_start TEXT NOT NULL,
      period_end TEXT NOT NULL,
      row_count INTEGER NOT NULL,
      card_id INTEGER REFERENCES cards(id),
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

  // Migration: add card_id column to statements if it doesn't exist
  const stmtCols = db.prepare("PRAGMA table_info(statements)").all();
  const hasCardId = stmtCols.some(col => col.name === 'card_id');
  if (!hasCardId) {
    db.run('ALTER TABLE statements ADD COLUMN card_id INTEGER REFERENCES cards(id)');
  }

  // Migration: link existing statements to "Unknown Card"
  const orphanCount = db.prepare('SELECT COUNT(*) as count FROM statements WHERE card_id IS NULL').get().count;
  if (orphanCount > 0) {
    const unknownCard = findOrCreateCard('Unknown', '0000');
    db.run('UPDATE statements SET card_id = ? WHERE card_id IS NULL', [unknownCard]);
  }

  console.log('✅ Database initialized at:', dbPath);
}

/**
 * Find a card by bank name and last 4 digits
 */
export function findCard(bankName, cardLast4) {
  return db.query('SELECT * FROM cards WHERE bank_name = ? AND card_last4 = ?').get(bankName, cardLast4);
}

/**
 * Insert a new card
 */
export function insertCard(bankName, cardLast4, cardLabel) {
  const createdAt = new Date().toISOString();
  const result = db.query(
    'INSERT INTO cards (bank_name, card_last4, card_label, created_at) VALUES (?, ?, ?, ?)'
  ).run(bankName, cardLast4, cardLabel, createdAt);
  return result.lastInsertRowid;
}

/**
 * Find existing card or create a new one. Returns card ID.
 */
export function findOrCreateCard(bankName, cardLast4, cardLabel) {
  const existing = findCard(bankName, cardLast4);
  if (existing) return existing.id;
  const label = cardLabel || `${bankName} ...${cardLast4}`;
  return insertCard(bankName, cardLast4, label);
}

/**
 * Get all cards with statement counts
 */
export function getAllCards() {
  return db.query(`
    SELECT c.*, COUNT(s.id) as statement_count
    FROM cards c
    LEFT JOIN statements s ON c.id = s.card_id
    GROUP BY c.id
    ORDER BY c.created_at DESC
  `).all();
}

/**
 * Get all transactions sorted by date descending, with card info
 */
export function getAllTransactions(cardId) {
  if (cardId) {
    return db.query(`
      SELECT t.*, c.id as card_id, c.bank_name, c.card_last4, c.card_label
      FROM transactions t
      LEFT JOIN statements s ON t.statement_id = s.id
      LEFT JOIN cards c ON s.card_id = c.id
      WHERE c.id = ?
      ORDER BY t.date DESC
    `).all(cardId);
  }
  return db.query(`
    SELECT t.*, c.id as card_id, c.bank_name, c.card_last4, c.card_label
    FROM transactions t
    LEFT JOIN statements s ON t.statement_id = s.id
    LEFT JOIN cards c ON s.card_id = c.id
    ORDER BY t.date DESC
  `).all();
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
export function insertStatement(fileName, fileHash, periodStart, periodEnd, rowCount, cardId) {
  const uploadedAt = new Date().toISOString();
  const query = db.query(`
    INSERT INTO statements (file_name, file_hash, period_start, period_end, row_count, card_id, uploaded_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const result = query.run(fileName, fileHash, periodStart, periodEnd, rowCount, cardId, uploadedAt);
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
 * Execute a read-only SQL query (for AI chat feature)
 * Validates that the query is a safe SELECT before executing
 */
const DANGEROUS_KEYWORDS = /\b(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|ATTACH|DETACH|PRAGMA|REPLACE)\b/i;

export function executeReadOnlyQuery(sql) {
  const trimmed = sql.trim();

  // Must start with SELECT
  if (!/^\s*SELECT/i.test(trimmed)) {
    throw new Error('Only SELECT queries are allowed');
  }

  // Reject dangerous keywords
  if (DANGEROUS_KEYWORDS.test(trimmed)) {
    throw new Error('Query contains disallowed keywords');
  }

  // Reject multiple statements (semicolons before the end)
  const withoutStrings = trimmed.replace(/'[^']*'/g, ''); // strip string literals
  if (withoutStrings.indexOf(';') !== -1) {
    throw new Error('Multiple statements are not allowed');
  }

  // Auto-append LIMIT if not present
  let query = trimmed;
  if (!/\bLIMIT\b/i.test(query)) {
    query = `${query} LIMIT 100`;
  }

  const rows = db.query(query).all();
  const columns = rows.length > 0 ? Object.keys(rows[0]) : [];
  return { rows, columns };
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
