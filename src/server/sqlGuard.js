/**
 * Validation for LLM-generated SQL (AI chat). Pure functions, no DB access,
 * so they can be shared by the main thread and the query worker.
 */
export const MAX_SQL_LENGTH = 2000;
export const ROW_LIMIT = 100;

const DANGEROUS_KEYWORDS = /\b(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|ATTACH|DETACH|PRAGMA|REPLACE|VACUUM|REINDEX|RECURSIVE)\b/i;
const BLOCKED_OBJECTS = /\b(sqlite_master|sqlite_schema|sqlite_temp_master|sqlite_\w*|sessions)\b/i;
const BLOCKED_FUNCTIONS = /\b(randomblob|zeroblob|load_extension|readfile|writefile|edit|fts3_tokenizer)\s*\(/i;

/** Remove string literals ('...' with '' escapes) so checks ignore quoted text. */
function stripStrings(sql) {
  return sql.replace(/'(?:[^']|'')*'/g, "''");
}

/** Remove -- line comments and /* block comments *\/ outside string literals. */
export function stripComments(sql) {
  let out = '';
  let i = 0;
  while (i < sql.length) {
    const ch = sql[i];
    if (ch === "'") {
      const end = sql.indexOf("'", i + 1);
      let j = end;
      while (j !== -1 && sql[j + 1] === "'") j = sql.indexOf("'", j + 2);
      if (j === -1) { out += sql.slice(i); break; }
      out += sql.slice(i, j + 1);
      i = j + 1;
    } else if (ch === '-' && sql[i + 1] === '-') {
      const nl = sql.indexOf('\n', i);
      i = nl === -1 ? sql.length : nl;
      out += ' ';
    } else if (ch === '/' && sql[i + 1] === '*') {
      const close = sql.indexOf('*/', i + 2);
      i = close === -1 ? sql.length : close + 2;
      out += ' ';
    } else {
      out += ch;
      i++;
    }
  }
  return out;
}

/**
 * Validate and wrap a model-generated query. Returns the SQL to execute
 * (always wrapped in an outer LIMIT) or throws an Error.
 */
export function prepareReadOnlySql(sql) {
  if (typeof sql !== 'string') throw new Error('Query must be a string');
  if (sql.length > MAX_SQL_LENGTH) throw new Error('Query is too long');

  const cleaned = stripComments(sql).trim().replace(/;\s*$/, '').trim();

  if (!/^SELECT\b/i.test(cleaned)) {
    throw new Error('Only SELECT queries are allowed');
  }

  const noStrings = stripStrings(cleaned);

  // Keyword checks run on the full text (including literals) to stay strict:
  // a literal like 'DELETE' is rejected too.
  if (DANGEROUS_KEYWORDS.test(cleaned)) {
    throw new Error('Query contains disallowed keywords');
  }
  if (BLOCKED_OBJECTS.test(noStrings)) {
    throw new Error('Query references disallowed system tables');
  }
  if (BLOCKED_FUNCTIONS.test(noStrings)) {
    throw new Error('Query uses a disallowed function');
  }
  if (noStrings.includes(';')) {
    throw new Error('Multiple statements are not allowed');
  }

  return `SELECT * FROM (${cleaned}) LIMIT ${ROW_LIMIT}`;
}
