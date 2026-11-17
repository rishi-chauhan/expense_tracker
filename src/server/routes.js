import {
  getAllTransactions,
  getAllStatements,
  checkDuplicateStatement,
  insertStatement,
  insertTransaction,
  deleteStatement,
  findOrCreateCard,
  getAllCards,
  checkDbHealthy,
  getAllCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory,
  getAllCategoryRules,
  createCategoryRule,
  deleteCategoryRule,
  createCategoryMatcher,
  runInTransaction,
  setTransactionCategory,
  applyCategoryRules,
  getAllBudgets,
  upsertBudget,
  deleteBudget,
  getCategorySpendForMonth,
  detectRecurring,
  getTransactionsForExport,
  optimizeDatabase,
} from './db.js';
import { generateFileHash, generateTxHash } from './utils.js';
import { parseCSV } from './parser.js';
import { checkHealth, generateSQL, summarizeResults } from './ollama.js';
import { MAX_UPLOAD_SIZE, OLLAMA_SUMMARIZE } from './config.js';
import { startedAt } from './dataVersion.js';
import {
  runReadOnlyQuery,
  QueryTimeoutError,
  QueryEngineUnavailableError,
} from './queryRunner.js';

/* ────────────────────────── helpers ────────────────────────── */

function json(body, status = 200) {
  return Response.json(body, { status });
}

function fail(status, error) {
  return json({ success: false, error }, status);
}

function serverError(context, error) {
  console.error(`Error ${context}:`, error);
  return fail(500, 'Internal server error');
}

class ValidationError extends Error {}

/** Parse a JSON body; throws ValidationError (→ 400) on malformed input. */
async function readJson(req) {
  let body;
  try {
    body = await req.json();
  } catch {
    throw new ValidationError('Invalid JSON body');
  }
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    throw new ValidationError('JSON body must be an object');
  }
  return body;
}

const DATE_RE = /^\d{4}-\d{2}(-\d{2})?$/;
const COLOR_RE = /^#[0-9a-fA-F]{6}$/;
const ICON_RE = /^[a-z-]{1,20}$/;

const v = {
  /** Trimmed string with length bounds; returns undefined when absent and optional. */
  string(value, field, { min = 1, max = 40, optional = false } = {}) {
    if (value == null || value === '') {
      if (optional) return undefined;
      throw new ValidationError(`${field} is required`);
    }
    if (typeof value !== 'string') throw new ValidationError(`${field} must be a string`);
    const s = value.trim();
    if (s.length < min || s.length > max) {
      if (s.length === 0 && optional) return undefined;
      throw new ValidationError(
        s.length === 0 ? `${field} is required` : `${field} must be ${min}–${max} characters`
      );
    }
    return s;
  },
  positiveInt(value, field, { optional = false } = {}) {
    if (value == null || value === '') {
      if (optional) return undefined;
      throw new ValidationError(`${field} is required`);
    }
    const n = typeof value === 'number' ? value : Number(String(value).trim());
    if (!Number.isInteger(n) || n <= 0 || n > Number.MAX_SAFE_INTEGER) {
      throw new ValidationError(`${field} must be a positive integer`);
    }
    return n;
  },
  /** null (explicit clear), undefined (absent) or a valid value. */
  nullablePattern(value, field, re) {
    if (value === undefined) return undefined;
    if (value === null || value === '') return null;
    if (typeof value !== 'string' || !re.test(value)) {
      throw new ValidationError(`${field} is invalid`);
    }
    return value;
  },
  date(value, field) {
    if (value == null || value === '') return undefined;
    if (!DATE_RE.test(value)) throw new ValidationError(`${field} must be YYYY-MM or YYYY-MM-DD`);
    return value;
  },
};

function looksLikeCsv(content) {
  if (!content || typeof content !== 'string') return false;
  const sample = content.slice(0, 4096);
  if (!sample.trim()) return false;
  if (/DATE/i.test(sample) && /AMT|AMOUNT|DEBIT|CREDIT/i.test(sample)) return true;
  const lines = sample.split(/\r?\n/).filter(l => l.trim()).slice(0, 5);
  if (lines.length === 0) return false;
  return lines.some(l => /[~|,;\t]/.test(l));
}

function csvEscape(value) {
  const s = value == null ? '' : String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/** Neutralise spreadsheet formula injection for free-text columns (S10). */
export function csvSafeText(value) {
  const s = value == null ? '' : String(value);
  return /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
}

function tooLarge() {
  return fail(413, `File too large. Maximum upload size is ${Math.round(MAX_UPLOAD_SIZE / 1024 / 1024)} MB`);
}

function currentYearMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

/** Only one AI question at a time — the Pi can't run two LLM calls well. */
let chatInFlight = false;

/* ────────────────────────── handlers ────────────────────────── */

async function handleUpload(req) {
  const contentLength = Number(req.headers.get('content-length') || 0);
  if (contentLength > MAX_UPLOAD_SIZE + 64 * 1024) return tooLarge();

  let formData;
  try {
    formData = await req.formData();
  } catch {
    return fail(400, 'Upload must be multipart/form-data');
  }
  const file = formData.get('file');

  if (!file || typeof file === 'string') return fail(400, 'No file provided');

  const fileName = file.name || '';
  if (!fileName.toLowerCase().endsWith('.csv')) {
    return fail(400, 'File must have a .csv extension');
  }
  if ((file.size ?? 0) > MAX_UPLOAD_SIZE) return tooLarge();

  const content = await file.text();
  if (content.length > MAX_UPLOAD_SIZE) return tooLarge();

  if (!looksLikeCsv(content)) {
    return fail(400, 'File does not look like a valid CSV statement');
  }

  // Validate manual overrides before doing any work.
  const bankOverride = v.string(formData.get('bankName'), 'Bank name', { max: 40, optional: true });
  const rawLast4 = formData.get('cardLast4');
  let last4Override;
  if (rawLast4 != null && String(rawLast4).trim() !== '') {
    last4Override = String(rawLast4).trim();
    if (!/^\d{4}$/.test(last4Override)) {
      throw new ValidationError('Card last 4 must be exactly 4 digits');
    }
  }
  const cardLabel = v.string(formData.get('cardLabel'), 'Card label', { max: 40, optional: true }) || null;

  const fileHash = generateFileHash(content);
  const existingStatement = checkDuplicateStatement(fileHash);
  if (existingStatement) {
    return json({ isDuplicate: true, existingStatement });
  }

  let parsed;
  try {
    parsed = await parseCSV(content, fileName);
  } catch (error) {
    console.error('CSV parse failed:', error);
    return fail(400, 'Could not parse CSV. Is this a supported statement format?');
  }
  const { transactions, cardInfo } = parsed;

  if (transactions.length === 0) return fail(400, 'No valid transactions found in CSV');

  const bankName = bankOverride || cardInfo.bankName;
  const cardLast4 = last4Override || cardInfo.cardLast4;

  if (!bankName || !cardLast4) {
    return json({
      success: false,
      needsCardInfo: true,
      detected: cardInfo,
      transactionCount: transactions.length,
    }, 422);
  }

  // ISO YYYY-MM-DD strings compare lexicographically — no Date parsing or spread.
  let periodStart = transactions[0].date.slice(0, 10);
  let periodEnd = periodStart;
  for (const t of transactions) {
    const d = t.date.slice(0, 10);
    if (d < periodStart) periodStart = d;
    if (d > periodEnd) periodEnd = d;
  }

  const { cardId, statementId, newCount, duplicateCount } = runInTransaction(() => {
    const cardId = findOrCreateCard(bankName, cardLast4, cardLabel);
    const statementId = insertStatement(
      fileName, fileHash, periodStart, periodEnd, transactions.length, cardId
    );
    const getCategoryId = createCategoryMatcher();
    let newCount = 0;
    for (const tx of transactions) {
      newCount += insertTransaction(
        generateTxHash(tx.date, tx.amount, tx.description),
        tx.date, tx.amount, tx.description, tx.isCredit, tx.type,
        statementId, getCategoryId(tx.description)
      );
    }
    return { cardId, statementId, newCount, duplicateCount: transactions.length - newCount };
  });

  optimizeDatabase();

  return json({
    success: true,
    newCount,
    duplicateCount,
    statementInfo: {
      id: statementId,
      fileName,
      periodStart,
      periodEnd,
      totalRows: transactions.length,
    },
    cardInfo: { bankName, cardLast4, cardId },
  });
}

function categoryPayload(body, { partial }) {
  const out = {};
  const name = v.string(body.name, 'Name', { max: 40, optional: partial });
  if (name !== undefined) out.name = name;
  const color = v.nullablePattern(body.color, 'Color', COLOR_RE);
  if (color !== undefined) out.color = color;
  const icon = v.nullablePattern(body.icon, 'Icon', ICON_RE);
  if (icon !== undefined) out.icon = icon;
  return out;
}

async function handleChat(req) {
  const body = await readJson(req);
  const { question } = body;

  if (!question || typeof question !== 'string' || question.trim().length === 0) {
    return fail(400, 'Question is required');
  }
  if (question.length > 500) return fail(400, 'Question must be 500 characters or less');

  if (chatInFlight) return fail(429, 'Another question is being answered');
  chatInFlight = true;
  try {
    let sql;
    try {
      sql = await generateSQL(question.trim());
    } catch (error) {
      console.error('SQL generation failed:', error);
      return fail(502, 'Could not generate query. Is Ollama running?');
    }

    let rows;
    try {
      rows = await runReadOnlyQuery(sql, { timeoutMs: 3000 });
    } catch (error) {
      if (error instanceof QueryEngineUnavailableError) {
        console.error('AI query engine unavailable:', error);
        return fail(503, 'AI query engine unavailable');
      }
      if (error instanceof QueryTimeoutError) {
        console.error('Query timed out. SQL:', sql);
        return fail(422, 'Query took too long. Try a narrower question.');
      }
      console.error('Query execution failed:', error.message, 'SQL:', sql);
      // Do not echo raw SQL / DB errors in client-facing messages.
      return fail(422, 'Query failed. Try rephrasing your question.');
    }

    const fallback = rows.length > 0
      ? `Found ${rows.length} result${rows.length === 1 ? '' : 's'}.`
      : 'No results found for your query.';

    let answer = fallback;
    if (OLLAMA_SUMMARIZE) {
      try {
        answer = (await summarizeResults(question.trim(), sql, rows)) || fallback;
      } catch (error) {
        console.error('Summary generation failed:', error);
      }
    }

    return json({
      success: true,
      answer,
      sql,
      rowCount: rows.length,
      data: rows.slice(0, 50),
    });
  } finally {
    chatInFlight = false;
  }
}

/* ────────────────────────── router ────────────────────────── */

/**
 * Handle API requests. Security checks (CSRF, host, size, auth) run in app.js
 * before this is called.
 */
export async function handleApiRequest(req, url) {
  try {
    return await route(req, url);
  } catch (error) {
    if (error instanceof ValidationError) return fail(400, error.message);
    return serverError(`handling ${req.method} ${url.pathname}`, error);
  }
}

async function route(req, url) {
  const { pathname } = url;
  const method = req.method;
  const q = url.searchParams;

  if (pathname === '/api/health' && method === 'GET') {
    const dbOk = checkDbHealthy();
    return json({
      success: dbOk,
      status: dbOk ? 'ok' : 'degraded',
      db: dbOk,
      uptime: Math.floor((Date.now() - startedAt) / 1000),
    }, dbOk ? 200 : 503);
  }

  if (pathname === '/api/cards' && method === 'GET') {
    return json({ success: true, cards: getAllCards() });
  }

  if (pathname === '/api/transactions' && method === 'GET') {
    const cardId = v.positiveInt(q.get('cardId'), 'cardId', { optional: true });
    return json({ success: true, transactions: getAllTransactions(cardId) });
  }

  if (pathname === '/api/upload' && method === 'POST') {
    return handleUpload(req);
  }

  if (pathname === '/api/statements' && method === 'GET') {
    return json({ success: true, statements: getAllStatements() });
  }

  const deleteMatch = pathname.match(/^\/api\/statements\/(\d+)$/);
  if (deleteMatch && method === 'DELETE') {
    const changes = deleteStatement(parseInt(deleteMatch[1], 10));
    if (changes === 0) return fail(404, 'Statement not found');
    return json({ success: true, deletedCount: changes });
  }

  // ── Categories ──
  if (pathname === '/api/categories' && method === 'GET') {
    return json({ success: true, categories: getAllCategories(), rules: getAllCategoryRules() });
  }

  if (pathname === '/api/categories' && method === 'POST') {
    const body = await readJson(req);
    const { name, color = null, icon = null } = categoryPayload(body, { partial: false });
    try {
      const id = createCategory(name, color, icon);
      return json({ success: true, id }, 201);
    } catch (error) {
      if (/UNIQUE/i.test(error.message)) return fail(409, 'A category with that name already exists');
      throw error;
    }
  }

  const categoryMatch = pathname.match(/^\/api\/categories\/(\d+)$/);
  if (categoryMatch && method === 'PUT') {
    const id = parseInt(categoryMatch[1], 10);
    const body = await readJson(req);
    try {
      const changes = updateCategory(id, categoryPayload(body, { partial: true }));
      if (changes === 0) return fail(404, 'Category not found');
      return json({ success: true });
    } catch (error) {
      if (/UNIQUE/i.test(error.message)) return fail(409, 'A category with that name already exists');
      throw error;
    }
  }

  if (categoryMatch && method === 'DELETE') {
    const changes = deleteCategory(parseInt(categoryMatch[1], 10));
    if (changes === 0) return fail(404, 'Category not found');
    return json({ success: true });
  }

  if (pathname === '/api/categories/rules' && method === 'POST') {
    const body = await readJson(req);
    const categoryId = v.positiveInt(body.categoryId, 'categoryId');
    const pattern = v.string(body.pattern, 'Pattern', { max: 60 });
    let priority = 0;
    if (body.priority != null && body.priority !== '') {
      priority = Number(body.priority);
      if (!Number.isInteger(priority) || priority < 0 || priority > 100) {
        return fail(400, 'Priority must be an integer from 0 to 100');
      }
    }
    if (!getCategoryById(categoryId)) return fail(400, 'Category does not exist');
    try {
      const id = createCategoryRule(categoryId, pattern, priority);
      return json({ success: true, id }, 201);
    } catch (error) {
      if (/UNIQUE/i.test(error.message)) return fail(409, 'That rule pattern already exists');
      throw error;
    }
  }

  const ruleMatch = pathname.match(/^\/api\/categories\/rules\/(\d+)$/);
  if (ruleMatch && method === 'DELETE') {
    const changes = deleteCategoryRule(parseInt(ruleMatch[1], 10));
    if (changes === 0) return fail(404, 'Rule not found');
    return json({ success: true });
  }

  if (pathname === '/api/categories/apply-rules' && method === 'POST') {
    return json({ success: true, updated: applyCategoryRules() });
  }

  const txCatMatch = pathname.match(/^\/api\/transactions\/(\d+)\/category$/);
  if (txCatMatch && method === 'PUT') {
    const txId = parseInt(txCatMatch[1], 10);
    const body = await readJson(req);
    const categoryId = body.categoryId == null || body.categoryId === ''
      ? null
      : v.positiveInt(body.categoryId, 'categoryId');
    if (categoryId != null && !getCategoryById(categoryId)) {
      return fail(400, 'Category does not exist');
    }
    const changes = setTransactionCategory(txId, categoryId, true);
    if (changes === 0) return fail(404, 'Transaction not found');
    return json({ success: true });
  }

  if (pathname === '/api/export' && method === 'GET') {
    const rows = getTransactionsForExport({
      cardId: v.positiveInt(q.get('cardId'), 'cardId', { optional: true }),
      startDate: v.date(q.get('startDate'), 'startDate'),
      endDate: v.date(q.get('endDate'), 'endDate'),
      categoryId: v.positiveInt(q.get('categoryId'), 'categoryId', { optional: true }),
    });

    const header = ['Date', 'Amount', 'Description', 'Type', 'IsCredit', 'Card', 'Category'];
    const lines = [header.join(',')];
    for (const row of rows) {
      lines.push([
        csvEscape(row.date),
        csvEscape(row.amount),
        csvEscape(csvSafeText(row.description)),
        csvEscape(csvSafeText(row.type)),
        csvEscape(row.is_credit ? 'credit' : 'debit'),
        csvEscape(csvSafeText(row.card_label || `${row.bank_name || ''} ...${row.card_last4 || ''}`)),
        csvEscape(csvSafeText(row.category_name || '')),
      ].join(','));
    }

    return new Response(lines.join('\n') + '\n', {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="transactions.csv"',
      },
    });
  }

  // ── Budgets ──
  if (pathname === '/api/budgets' && method === 'GET') {
    const month = q.get('month');
    if (month && !/^\d{4}-\d{2}$/.test(month)) return fail(400, 'month must be YYYY-MM');
    const yearMonth = month || currentYearMonth();
    const spend = getCategorySpendForMonth(yearMonth);
    const spendMap = Object.fromEntries(spend.map(s => [s.category_id, s.spent]));
    const budgets = getAllBudgets().map(b => ({
      ...b,
      spent: spendMap[b.category_id] || 0,
      yearMonth,
    }));
    return json({ success: true, budgets, yearMonth });
  }

  if (pathname === '/api/budgets' && method === 'POST') {
    const body = await readJson(req);
    const categoryId = v.positiveInt(body.categoryId, 'categoryId');
    const amount = Number(body.amount);
    if (!Number.isFinite(amount) || amount <= 0 || amount >= 1e9) {
      return fail(400, 'Amount must be a positive number below 1,000,000,000');
    }
    const period = body.period == null || body.period === '' ? 'monthly' : body.period;
    if (period !== 'monthly') return fail(400, "Period must be 'monthly'");
    if (!getCategoryById(categoryId)) return fail(400, 'Category does not exist');
    return json({ success: true, id: upsertBudget(categoryId, amount, period) });
  }

  const budgetMatch = pathname.match(/^\/api\/budgets\/(\d+)$/);
  if (budgetMatch && method === 'DELETE') {
    const changes = deleteBudget(parseInt(budgetMatch[1], 10));
    if (changes === 0) return fail(404, 'Budget not found');
    return json({ success: true });
  }

  if (pathname === '/api/recurring' && method === 'GET') {
    return json({ success: true, recurring: detectRecurring() });
  }

  // ── AI chat ──
  if (pathname === '/api/chat/health' && method === 'GET') {
    const health = await checkHealth();
    return json({ success: true, ...health });
  }

  if (pathname === '/api/chat' && method === 'POST') {
    return handleChat(req);
  }

  return fail(404, 'Not Found');
}
