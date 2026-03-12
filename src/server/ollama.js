const OLLAMA_BASE_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const MODEL = process.env.OLLAMA_MODEL || 'qwen2.5:1.5b';

const SCHEMA_PROMPT = `You are a SQL expert for an expense tracking app using SQLite. Given the user's question, generate a single SELECT query to answer it.

Database schema (3 tables):

CREATE TABLE cards (id INTEGER PRIMARY KEY, bank_name TEXT, card_last4 TEXT, card_label TEXT, created_at TEXT);
CREATE TABLE statements (id INTEGER PRIMARY KEY, card_id INTEGER REFERENCES cards(id), file_name TEXT, file_hash TEXT, period_start TEXT, period_end TEXT, row_count INTEGER, uploaded_at TEXT);
CREATE TABLE transactions (id INTEGER PRIMARY KEY, statement_id INTEGER REFERENCES statements(id), tx_hash TEXT, date TEXT, amount REAL, description TEXT, is_credit INTEGER, type TEXT, uploaded_at TEXT);

Joins: transactions.statement_id → statements.id → statements.card_id → cards.id
The "description" column (merchant name) is ONLY in the transactions table.
The "card_label" column is ONLY in the cards table.
The "date" column is ONLY in the transactions table (format: YYYY-MM-DD).

Rules:
- Output ONLY the SQL query. No explanation, no markdown fences.
- is_credit: 0 = debit (expense), 1 = credit (refund/cashback). amount is always positive.
- Amounts are stored as plain numbers WITHOUT commas. ₹60,349.05 means amount = 60349.05 (NOT 60.34905). Always remove commas and ₹ symbol when converting to numbers.
- Use LIKE with LOWER() for case-insensitive description matching
- Exclude rows where description contains 'CC PAYMENT' or 'BPPY' from spending analysis unless asked
- Use SQLite date functions for relative dates (e.g., date('now','-1 month'))

IMPORTANT: transactions has NO card_id column. To join transactions to cards, you MUST go through statements:
JOIN statements s ON t.statement_id = s.id JOIN cards c ON s.card_id = c.id

Examples:

Top 5 merchants by spending:
SELECT t.description, SUM(t.amount) AS total FROM transactions t WHERE t.is_credit = 0 AND LOWER(t.description) NOT LIKE '%cc payment%' AND LOWER(t.description) NOT LIKE '%bppy%' GROUP BY LOWER(t.description) ORDER BY total DESC LIMIT 5

All transactions at a merchant:
SELECT t.date, t.description, t.amount, t.type FROM transactions t WHERE LOWER(t.description) LIKE '%merchant name%' ORDER BY t.date DESC

Monthly spending trend:
SELECT strftime('%Y-%m', t.date) AS month, SUM(t.amount) AS total FROM transactions t WHERE t.is_credit = 0 AND LOWER(t.description) NOT LIKE '%cc payment%' AND LOWER(t.description) NOT LIKE '%bppy%' GROUP BY month ORDER BY month`;

const SUMMARY_PROMPT = `You are a helpful financial assistant. Given the user's question, the SQL query that was run, and the query results, provide a well-formatted natural language answer.

Formatting rules:
- Currency amounts in the results are already formatted as ₹ with Indian commas. Copy them EXACTLY as-is — do NOT reformat, recalculate, or round.
- Format dates as DD-MM-YYYY (e.g., 02-09-2023 for September 2nd)
- For lists/tables, use numbered lines with clear alignment:
  1. Merchant Name — ₹Amount
  2. Merchant Name — ₹Amount
- For single values, give a clear one-line answer
- Keep it concise but readable. If results are empty, say so clearly.`;

/**
 * Check if Ollama is running and the target model is available
 */
export async function checkHealth() {
  try {
    const res = await fetch(`${OLLAMA_BASE_URL}/api/tags`, {
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) {
      return { available: false, error: `Ollama returned ${res.status}` };
    }
    const data = await res.json();
    const models = (data.models || []).map(m => m.name);
    const hasModel = models.some(name => name.startsWith(MODEL.split(':')[0]));
    return { available: hasModel, model: MODEL, models };
  } catch (error) {
    return { available: false, error: error.message };
  }
}

/**
 * Generate a SQL SELECT query from a natural language question
 */
export async function generateSQL(question) {
  const res = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      system: SCHEMA_PROMPT,
      prompt: question,
      stream: false,
      options: { temperature: 0, num_predict: 256 },
    }),
    signal: AbortSignal.timeout(60000),
  });

  if (!res.ok) {
    throw new Error(`Ollama returned ${res.status}`);
  }

  const data = await res.json();
  let sql = (data.response || '').trim();

  // Strip markdown code fences if present
  const fenceMatch = sql.match(/```(?:sql)?\n?([\s\S]*?)```/);
  if (fenceMatch) {
    sql = fenceMatch[1].trim();
  }

  // Remove trailing semicolons
  sql = sql.replace(/;\s*$/, '');

  // Validate it's a SELECT
  if (!sql.match(/^\s*SELECT/i)) {
    throw new Error('Model did not generate a SELECT query');
  }

  return sql;
}

/**
 * Format a number in Indian comma notation (e.g., 196998.05 → ₹1,96,998.05)
 */
function formatINR(num) {
  const [intPart, decPart] = Math.abs(num).toFixed(2).split('.');
  // Indian grouping: last 3 digits, then groups of 2
  let formatted = intPart.slice(-3);
  let remaining = intPart.slice(0, -3);
  while (remaining.length > 0) {
    formatted = remaining.slice(-2) + ',' + formatted;
    remaining = remaining.slice(0, -2);
  }
  return '₹' + formatted + '.' + decPart;
}

/**
 * Pre-format numeric values in query results for the summarizer
 */
function formatResultsForSummary(rows) {
  return rows.map(row => {
    const formatted = {};
    for (const [key, value] of Object.entries(row)) {
      if (typeof value === 'number' && !key.toLowerCase().includes('id') && !key.toLowerCase().includes('count') && !key.toLowerCase().includes('credit')) {
        formatted[key] = formatINR(value);
      } else {
        formatted[key] = value;
      }
    }
    return formatted;
  });
}

/**
 * Summarize query results in natural language
 */
export async function summarizeResults(question, sql, rows) {
  // Truncate to first 50 rows and pre-format amounts
  const truncated = rows.slice(0, 50);
  const formatted = formatResultsForSummary(truncated);
  const prompt = `User question: ${question}

SQL query executed: ${sql}

Results (${rows.length} rows${rows.length > 50 ? ', showing first 50' : ''}):
${JSON.stringify(formatted, null, 2)}`;

  const res = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      system: SUMMARY_PROMPT,
      prompt,
      stream: false,
      options: { temperature: 0.3, num_predict: 512 },
    }),
    signal: AbortSignal.timeout(60000),
  });

  if (!res.ok) {
    throw new Error(`Ollama returned ${res.status}`);
  }

  const data = await res.json();
  return (data.response || '').trim();
}
