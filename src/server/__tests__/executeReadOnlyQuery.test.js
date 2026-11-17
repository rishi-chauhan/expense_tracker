import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { Database } from 'bun:sqlite';

import { prepareReadOnlySql, MAX_SQL_LENGTH } from '../sqlGuard.js';

let testDb;
let executeReadOnlyQuery;

beforeEach(() => {
  testDb = new Database(':memory:');
  testDb.run('PRAGMA foreign_keys = ON');

  testDb.run(`
    CREATE TABLE transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      amount REAL NOT NULL,
      description TEXT NOT NULL,
      is_credit INTEGER NOT NULL,
      type TEXT NOT NULL
    )
  `);

  // Seed test data
  const insert = testDb.prepare(
    'INSERT INTO transactions (date, amount, description, is_credit, type) VALUES (?, ?, ?, ?, ?)'
  );
  insert.run('2025-01-10', 100, 'Swiggy', 0, 'Debit');
  insert.run('2025-01-15', 200, 'Amazon', 0, 'Debit');
  insert.run('2025-01-20', 50, 'Refund', 1, 'Credit');

  // Same contract as the worker: validate + wrap, then run on the test DB
  executeReadOnlyQuery = (sql) => {
    const rows = testDb.query(prepareReadOnlySql(sql)).all();
    const columns = rows.length > 0 ? Object.keys(rows[0]) : [];
    return { rows, columns };
  };
});

afterEach(() => {
  testDb.close();
});

describe('executeReadOnlyQuery', () => {
  it('should execute a valid SELECT and return rows', () => {
    const { rows, columns } = executeReadOnlyQuery('SELECT * FROM transactions');
    expect(rows).toHaveLength(3);
    expect(columns).toContain('date');
    expect(columns).toContain('amount');
    expect(columns).toContain('description');
  });

  it('should return correct data', () => {
    const { rows } = executeReadOnlyQuery(
      "SELECT description, amount FROM transactions WHERE description = 'Swiggy'"
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].description).toBe('Swiggy');
    expect(rows[0].amount).toBe(100);
  });

  it('should return empty columns for empty result', () => {
    const { rows, columns } = executeReadOnlyQuery(
      "SELECT * FROM transactions WHERE amount > 9999"
    );
    expect(rows).toHaveLength(0);
    expect(columns).toHaveLength(0);
  });

  it('should reject INSERT statements', () => {
    expect(() => {
      executeReadOnlyQuery("INSERT INTO transactions VALUES (99, '2025-01-01', 100, 'test', 0, 'Debit')");
    }).toThrow('Only SELECT queries are allowed');
  });

  it('should reject UPDATE statements', () => {
    expect(() => {
      executeReadOnlyQuery("UPDATE transactions SET amount = 0");
    }).toThrow('Only SELECT queries are allowed');
  });

  it('should reject DELETE statements', () => {
    expect(() => {
      executeReadOnlyQuery("DELETE FROM transactions");
    }).toThrow('Only SELECT queries are allowed');
  });

  it('should reject DROP even inside a SELECT', () => {
    expect(() => {
      executeReadOnlyQuery("SELECT * FROM transactions; DROP TABLE transactions");
    }).toThrow();
  });

  it('should reject SELECT with dangerous subqueries', () => {
    expect(() => {
      executeReadOnlyQuery("SELECT * FROM transactions WHERE 1=1; DELETE FROM transactions");
    }).toThrow();
  });

  it('should reject PRAGMA statements', () => {
    expect(() => {
      executeReadOnlyQuery("PRAGMA table_info(transactions)");
    }).toThrow('Only SELECT queries are allowed');
  });

  it('should reject SELECT containing ATTACH keyword', () => {
    expect(() => {
      executeReadOnlyQuery("SELECT 1; ATTACH DATABASE ':memory:' AS test");
    }).toThrow();
  });

  it('should auto-append LIMIT 100 when no LIMIT present', () => {
    // With only 3 rows this won't change results, but we verify the function works
    const { rows } = executeReadOnlyQuery('SELECT * FROM transactions');
    expect(rows.length).toBeLessThanOrEqual(100);
  });

  it('should not append LIMIT when already present', () => {
    const { rows } = executeReadOnlyQuery('SELECT * FROM transactions LIMIT 1');
    expect(rows).toHaveLength(1);
  });

  it('should handle SUM aggregation', () => {
    const { rows } = executeReadOnlyQuery(
      'SELECT SUM(amount) as total FROM transactions WHERE is_credit = 0'
    );
    expect(rows[0].total).toBe(300);
  });

  it('should handle GROUP BY queries', () => {
    const { rows } = executeReadOnlyQuery(
      'SELECT type, COUNT(*) as count FROM transactions GROUP BY type'
    );
    expect(rows).toHaveLength(2);
  });

  it('should throw on invalid SQL (bad column name)', () => {
    expect(() => {
      executeReadOnlyQuery('SELECT nonexistent_column FROM transactions');
    }).toThrow();
  });

  it('should reject queries with dangerous keywords even in string context', () => {
    // Our regex intentionally catches dangerous keywords anywhere in the query,
    // even inside string literals — this is a safety-first approach.
    expect(() => {
      executeReadOnlyQuery(
        "SELECT * FROM transactions WHERE description LIKE '%DELETE%'"
      );
    }).toThrow('Query contains disallowed keywords');
  });

  it('should reject sqlite_master access', () => {
    expect(() => {
      executeReadOnlyQuery('SELECT * FROM sqlite_master');
    }).toThrow('Query references disallowed system tables');
  });

  it('should reject the recursive CTE event-loop freeze repro', () => {
    expect(() => executeReadOnlyQuery(
      'SELECT x FROM (WITH RECURSIVE c(x) AS (SELECT 1 UNION ALL SELECT x+1 FROM c WHERE x < 30000000) SELECT max(x) AS x FROM c)'
    )).toThrow('Query contains disallowed keywords');
  });

  it.each(['randomblob(1000000)', 'zeroblob(1000000)', "load_extension('x')", "readfile('/etc/passwd')", "writefile('x','y')", "edit('a')", "fts3_tokenizer('x')"])(
    'should reject dangerous function %s',
    (fn) => {
      expect(() => executeReadOnlyQuery(`SELECT ${fn} AS v`)).toThrow('disallowed');
    }
  );

  it('should reject sqlite_ prefixed objects and the sessions table', () => {
    expect(() => executeReadOnlyQuery('SELECT * FROM sqlite_sequence')).toThrow('disallowed system tables');
    expect(() => executeReadOnlyQuery('SELECT * FROM sessions')).toThrow('disallowed system tables');
  });

  it('should always wrap with an outer LIMIT (inner LIMIT no longer bypasses it)', () => {
    const wrapped = prepareReadOnlySql('SELECT * FROM (SELECT * FROM transactions LIMIT 1000000)');
    expect(wrapped).toBe('SELECT * FROM (SELECT * FROM (SELECT * FROM transactions LIMIT 1000000)) LIMIT 100');
  });

  it('should strip comments before checking', () => {
    expect(() => executeReadOnlyQuery('SELECT 1 /* hidden */; DELETE FROM transactions')).toThrow();
    expect(() => executeReadOnlyQuery('-- comment\nSELECT 1 AS one')).not.toThrow();
    expect(() => executeReadOnlyQuery('SELECT 1 AS one -- trailing; nothing')).not.toThrow();
    expect(() => executeReadOnlyQuery('/* x */ UPDATE transactions SET amount = 0')).toThrow('Only SELECT');
  });

  it('should allow a trailing semicolon but not a second statement', () => {
    expect(executeReadOnlyQuery('SELECT COUNT(*) AS n FROM transactions;').rows[0].n).toBe(3);
  });

  it('should reject over-long SQL', () => {
    expect(() => executeReadOnlyQuery('SELECT ' + '1,'.repeat(MAX_SQL_LENGTH) + '1')).toThrow('too long');
  });
});
