import { Database } from 'bun:sqlite';
import path from 'path';
import { DB_PATH } from './config.js';

// Ensure parent directory exists for custom DB_PATH
import { mkdirSync } from 'fs';
mkdirSync(path.dirname(DB_PATH), { recursive: true });

export const db = new Database(DB_PATH, { create: true });

// Enable foreign keys + WAL for safer concurrent reads / fewer SD-card issues
db.run('PRAGMA foreign_keys = ON');
db.run('PRAGMA journal_mode = WAL');
db.run('PRAGMA synchronous = NORMAL');
db.run('PRAGMA busy_timeout = 5000');

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
  const stmtCols = db.prepare('PRAGMA table_info(statements)').all();
  const hasCardId = stmtCols.some(col => col.name === 'card_id');
  if (!hasCardId) {
    db.run('ALTER TABLE statements ADD COLUMN card_id INTEGER REFERENCES cards(id)');
  }

  // Categories + rules + budgets (create before transaction category columns)
  db.run(`
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      color TEXT,
      icon TEXT,
      created_at TEXT NOT NULL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS category_rules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
      pattern TEXT NOT NULL,
      priority INTEGER DEFAULT 0,
      UNIQUE(pattern)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS budgets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category_id INTEGER NOT NULL UNIQUE REFERENCES categories(id) ON DELETE CASCADE,
      amount REAL NOT NULL,
      period TEXT NOT NULL DEFAULT 'monthly',
      created_at TEXT NOT NULL
    )
  `);

  // Migration: category columns on transactions
  const txCols = db.prepare('PRAGMA table_info(transactions)').all();
  if (!txCols.some(col => col.name === 'category_id')) {
    db.run('ALTER TABLE transactions ADD COLUMN category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL');
  }
  if (!txCols.some(col => col.name === 'category_manual')) {
    db.run('ALTER TABLE transactions ADD COLUMN category_manual INTEGER DEFAULT 0');
  }

  db.run('CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(category_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_transactions_statement ON transactions(statement_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_transactions_credit_date ON transactions(is_credit, date)');
  db.run('CREATE INDEX IF NOT EXISTS idx_statements_card ON statements(card_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_category_rules_priority ON category_rules(priority DESC)');

  // Seed default categories if empty
  const catCount = db.prepare('SELECT COUNT(*) as count FROM categories').get().count;
  if (catCount === 0) {
    const now = new Date().toISOString();
    const defaults = [
      ['Groceries', '#34d399', 'cart'],
      ['Dining', '#fb923c', 'utensils'],
      ['Transport', '#60a5fa', 'car'],
      ['Utilities', '#fbbf24', 'zap'],
      ['Shopping', '#a78bfa', 'bag'],
      ['Entertainment', '#f472b6', 'film'],
      ['Health', '#f43f5e', 'heart'],
      ['Transfer', '#94a3b8', 'repeat'],
      ['Other', '#8b90a0', 'tag'],
    ];
    const insert = db.prepare(
      'INSERT INTO categories (name, color, icon, created_at) VALUES (?, ?, ?, ?)'
    );
    for (const [name, color, icon] of defaults) {
      insert.run(name, color, icon, now);
    }

    const rules = [
      ['Groceries', 'BIGBASKET', 10],
      ['Groceries', 'BLINKIT', 10],
      ['Groceries', 'ZEPTO', 10],
      ['Groceries', 'DMART', 10],
      ['Dining', 'SWIGGY', 10],
      ['Dining', 'ZOMATO', 10],
      ['Transport', 'UBER', 10],
      ['Transport', 'OLA', 10],
      ['Transport', 'IRCTC', 10],
      ['Entertainment', 'NETFLIX', 10],
      ['Entertainment', 'SPOTIFY', 10],
      ['Entertainment', 'HOTSTAR', 10],
      ['Shopping', 'AMAZON', 5],
      ['Shopping', 'FLIPKART', 5],
      ['Shopping', 'MYNTRA', 5],
      ['Utilities', 'AIRTEL', 5],
      ['Utilities', 'JIO', 5],
      ['Utilities', 'BESCOM', 5],
      ['Health', 'PHARMEASY', 5],
      ['Health', '1MG', 5],
      ['Transfer', 'CC PAYMENT', 20],
      ['Transfer', 'BPPY', 20],
    ];
    const catByName = Object.fromEntries(
      db.query('SELECT id, name FROM categories').all().map(c => [c.name, c.id])
    );
    const insertRule = db.prepare(
      'INSERT OR IGNORE INTO category_rules (category_id, pattern, priority) VALUES (?, ?, ?)'
    );
    for (const [catName, pattern, priority] of rules) {
      insertRule.run(catByName[catName], pattern, priority);
    }
  }

  // Migration: link existing statements to "Unknown Card"
  const orphanCount = db.prepare('SELECT COUNT(*) as count FROM statements WHERE card_id IS NULL').get().count;
  if (orphanCount > 0) {
    const unknownCard = findOrCreateCard('Unknown', '0000');
    db.run('UPDATE statements SET card_id = ? WHERE card_id IS NULL', [unknownCard]);
  }

  console.log('✅ Database initialized at:', DB_PATH);
}

/**
 * Check DB is readable (for health endpoint)
 */
export function checkDbHealthy() {
  try {
    db.query('SELECT 1').get();
    return true;
  } catch {
    return false;
  }
}

export function runInTransaction(callback) {
  return db.transaction(callback)();
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
 * Get all transactions sorted by date descending, with card info and category
 */
export function getAllTransactions(cardId) {
  if (cardId) {
    return db.query(`
      SELECT t.*, c.id as card_id, c.bank_name, c.card_last4, c.card_label,
             cat.name as category_name, cat.color as category_color
      FROM transactions t
      LEFT JOIN statements s ON t.statement_id = s.id
      LEFT JOIN cards c ON s.card_id = c.id
      LEFT JOIN categories cat ON t.category_id = cat.id
      WHERE c.id = ?
      ORDER BY t.date DESC
    `).all(cardId);
  }
  return db.query(`
    SELECT t.*, c.id as card_id, c.bank_name, c.card_last4, c.card_label,
           cat.name as category_name, cat.color as category_color
    FROM transactions t
    LEFT JOIN statements s ON t.statement_id = s.id
    LEFT JOIN cards c ON s.card_id = c.id
    LEFT JOIN categories cat ON t.category_id = cat.id
    ORDER BY t.date DESC
  `).all();
}

/**
 * Get all statements with metadata and card label
 */
export function getAllStatements() {
  return db.query(`
    SELECT
      s.*,
      c.card_label,
      c.bank_name,
      c.card_last4,
      COUNT(t.id) as transaction_count
    FROM statements s
    LEFT JOIN cards c ON s.card_id = c.id
    LEFT JOIN transactions t ON s.id = t.statement_id
    GROUP BY s.id
    ORDER BY s.uploaded_at DESC
  `).all();
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
export function insertTransaction(txHash, date, amount, description, isCredit, type, statementId, categoryId = null) {
  const uploadedAt = new Date().toISOString();
  const query = db.query(`
    INSERT OR IGNORE INTO transactions
    (tx_hash, date, amount, description, is_credit, type, statement_id, uploaded_at, category_id, category_manual)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
  `);

  const result = query.run(
    txHash, date, amount, description, isCredit ? 1 : 0, type, statementId, uploadedAt, categoryId
  );
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
 * Categories CRUD
 */
export function getAllCategories() {
  return db.query(`
    SELECT c.*,
      (SELECT COUNT(*) FROM transactions t WHERE t.category_id = c.id) as transaction_count,
      (SELECT COUNT(*) FROM category_rules r WHERE r.category_id = c.id) as rule_count
    FROM categories c
    ORDER BY c.name ASC
  `).all();
}

export function createCategory(name, color = null, icon = null) {
  const createdAt = new Date().toISOString();
  const result = db.query(
    'INSERT INTO categories (name, color, icon, created_at) VALUES (?, ?, ?, ?)'
  ).run(name, color, icon, createdAt);
  return result.lastInsertRowid;
}

export function updateCategory(id, { name, color, icon }) {
  const existing = db.query('SELECT * FROM categories WHERE id = ?').get(id);
  if (!existing) return 0;
  const result = db.query(
    'UPDATE categories SET name = ?, color = ?, icon = ? WHERE id = ?'
  ).run(
    name ?? existing.name,
    color !== undefined ? color : existing.color,
    icon !== undefined ? icon : existing.icon,
    id
  );
  return result.changes;
}

export function deleteCategory(id) {
  const result = db.query('DELETE FROM categories WHERE id = ?').run(id);
  return result.changes;
}

export function getAllCategoryRules() {
  return db.query(`
    SELECT r.*, c.name as category_name
    FROM category_rules r
    JOIN categories c ON r.category_id = c.id
    ORDER BY r.priority DESC, r.pattern ASC
  `).all();
}

export function createCategoryRule(categoryId, pattern, priority = 0) {
  const result = db.query(
    'INSERT INTO category_rules (category_id, pattern, priority) VALUES (?, ?, ?)'
  ).run(categoryId, pattern, priority);
  return result.lastInsertRowid;
}

export function deleteCategoryRule(id) {
  const result = db.query('DELETE FROM category_rules WHERE id = ?').run(id);
  return result.changes;
}

/**
 * Match description against rules (highest priority first). Returns category_id or null.
 */
function matchCategory(description, rules) {
  if (!description) return null;
  const upper = description.toUpperCase();
  for (const rule of rules) {
    if (upper.includes(rule.pattern_upper)) return rule.category_id;
  }
  return null;
}

export function createCategoryMatcher() {
  const rules = db.query(
    'SELECT category_id, UPPER(pattern) as pattern_upper FROM category_rules ORDER BY priority DESC, id ASC'
  ).all();
  return (description) => matchCategory(description, rules);
}

export function setTransactionCategory(txId, categoryId, manual = true) {
  const result = db.query(
    'UPDATE transactions SET category_id = ?, category_manual = ? WHERE id = ?'
  ).run(categoryId, manual ? 1 : 0, txId);
  return result.changes;
}

/**
 * Apply auto-rules to transactions that are not manually categorized.
 * Returns number of updated rows.
 */
export function applyCategoryRules() {
  const txs = db.query(
    'SELECT id, description FROM transactions WHERE category_manual = 0 OR category_manual IS NULL'
  ).all();
  const update = db.prepare(
    'UPDATE transactions SET category_id = ? WHERE id = ? AND (category_manual = 0 OR category_manual IS NULL)'
  );
  const getCategoryId = createCategoryMatcher();
  return runInTransaction(() => {
    let updated = 0;
    for (const tx of txs) {
      const catId = getCategoryId(tx.description);
      if (catId != null) updated += update.run(catId, tx.id).changes;
    }
    return updated;
  });
}

/**
 * Budgets
 */
export function getAllBudgets() {
  return db.query(`
    SELECT b.*, c.name as category_name, c.color as category_color
    FROM budgets b
    JOIN categories c ON b.category_id = c.id
    ORDER BY c.name ASC
  `).all();
}

export function upsertBudget(categoryId, amount, period = 'monthly') {
  const createdAt = new Date().toISOString();
  const existing = db.query('SELECT id FROM budgets WHERE category_id = ?').get(categoryId);
  if (existing) {
    db.query('UPDATE budgets SET amount = ?, period = ? WHERE category_id = ?')
      .run(amount, period, categoryId);
    return existing.id;
  }
  const result = db.query(
    'INSERT INTO budgets (category_id, amount, period, created_at) VALUES (?, ?, ?, ?)'
  ).run(categoryId, amount, period, createdAt);
  return result.lastInsertRowid;
}

export function deleteBudget(categoryId) {
  return db.query('DELETE FROM budgets WHERE category_id = ?').run(categoryId).changes;
}

/**
 * Spending for current calendar month per category (debits only)
 */
export function getCategorySpendForMonth(yearMonth) {
  // yearMonth like '2026-08'
  const start = `${yearMonth}-01`;
  const [y, m] = yearMonth.split('-').map(Number);
  const nextMonth = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`;
  return db.query(`
    SELECT t.category_id, cat.name as category_name, cat.color as category_color,
           SUM(t.amount) as spent
    FROM transactions t
    LEFT JOIN categories cat ON t.category_id = cat.id
    WHERE t.is_credit = 0
      AND t.date >= ?
      AND t.date < ?
      AND t.category_id IS NOT NULL
    GROUP BY t.category_id
  `).all(start, nextMonth);
}

/**
 * Detect recurring merchants: same description (normalized) appearing 3+ months
 * with similar amounts (within 10%).
 */
export function detectRecurring() {
  const rows = db.query(`
    SELECT description, amount, date, is_credit
    FROM transactions
    WHERE is_credit = 0
    ORDER BY description, date
  `).all();

  // Group by uppercased description
  const groups = new Map();
  for (const row of rows) {
    const key = row.description.trim().toUpperCase().replace(/\s+/g, ' ');
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }

  const recurring = [];
  for (const [, txs] of groups) {
    if (txs.length < 3) continue;
    const months = new Set(txs.map(t => t.date.slice(0, 7)));
    if (months.size < 3) continue;

    const amounts = txs.map(t => t.amount);
    const avg = amounts.reduce((a, b) => a + b, 0) / amounts.length;
    const similar = amounts.filter(a => Math.abs(a - avg) / avg <= 0.1);
    if (similar.length < 3) continue;

    recurring.push({
      description: txs[0].description,
      occurrences: txs.length,
      months: months.size,
      avgAmount: Math.round(avg * 100) / 100,
      lastDate: txs[txs.length - 1].date,
      firstDate: txs[0].date,
    });
  }

  return recurring.sort((a, b) => b.avgAmount - a.avgAmount);
}

/**
 * Export transactions with optional filters
 */
export function getTransactionsForExport({ cardId, startDate, endDate, categoryId } = {}) {
  const clauses = [];
  const params = [];
  if (cardId) {
    clauses.push('c.id = ?');
    params.push(Number(cardId));
  }
  if (startDate) {
    clauses.push('t.date >= ?');
    params.push(startDate);
  }
  if (endDate) {
    clauses.push('t.date <= ?');
    params.push(endDate);
  }
  if (categoryId) {
    clauses.push('t.category_id = ?');
    params.push(Number(categoryId));
  }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  return db.query(`
    SELECT t.date, t.amount, t.description, t.type, t.is_credit,
           c.card_label, c.bank_name, c.card_last4,
           cat.name as category_name
    FROM transactions t
    LEFT JOIN statements s ON t.statement_id = s.id
    LEFT JOIN cards c ON s.card_id = c.id
    LEFT JOIN categories cat ON t.category_id = cat.id
    ${where}
    ORDER BY t.date DESC
  `).all(...params);
}

/**
 * Execute a read-only SQL query (for AI chat feature)
 * Uses a separate readonly connection when available.
 */
const DANGEROUS_KEYWORDS = /\b(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|ATTACH|DETACH|PRAGMA|REPLACE|VACUUM|REINDEX)\b/i;
const BLOCKED_OBJECTS = /\b(sqlite_master|sqlite_schema|sqlite_temp_master)\b/i;

let readonlyDb = null;
function getReadonlyDb() {
  if (!readonlyDb) {
    try {
      readonlyDb = new Database(DB_PATH, { readonly: true });
    } catch {
      readonlyDb = db;
    }
  }
  return readonlyDb;
}

export function executeReadOnlyQuery(sql) {
  const trimmed = sql.trim();

  if (!/^\s*SELECT/i.test(trimmed)) {
    throw new Error('Only SELECT queries are allowed');
  }

  if (DANGEROUS_KEYWORDS.test(trimmed)) {
    throw new Error('Query contains disallowed keywords');
  }

  if (BLOCKED_OBJECTS.test(trimmed)) {
    throw new Error('Query references disallowed system tables');
  }

  const withoutStrings = trimmed.replace(/'[^']*'/g, '');
  if (withoutStrings.indexOf(';') !== -1) {
    throw new Error('Multiple statements are not allowed');
  }

  let query = trimmed;
  if (!/\bLIMIT\b/i.test(query)) {
    query = `${query} LIMIT 100`;
  }

  const rows = getReadonlyDb().query(query).all();
  const columns = rows.length > 0 ? Object.keys(rows[0]) : [];
  return { rows, columns };
}

/**
 * Close DB connections (graceful shutdown)
 */
export function closeDatabase() {
  try {
    if (readonlyDb && readonlyDb !== db) {
      readonlyDb.close();
      readonlyDb = null;
    }
  } catch { /* ignore */ }
  try {
    db.close();
  } catch { /* ignore */ }
}

/**
 * Get statistics about stored data
 */
export function getStatistics() {
  const stats = db.query(`
    SELECT
      COUNT(*) as total_transactions,
      (SELECT COUNT(*) FROM statements) as total_statements,
      COALESCE(SUM(CASE WHEN is_credit = 0 THEN amount ELSE 0 END), 0) as total_debits,
      COALESCE(SUM(CASE WHEN is_credit = 1 THEN amount ELSE 0 END), 0) as total_credits
    FROM transactions
  `).get();

  return {
    totalTransactions: stats.total_transactions,
    totalStatements: stats.total_statements,
    totalDebits: stats.total_debits,
    totalCredits: stats.total_credits,
  };
}
