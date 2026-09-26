import {
  getAllTransactions,
  getAllStatements,
  checkDuplicateStatement,
  insertStatement,
  insertTransaction,
  deleteStatement,
  findOrCreateCard,
  getAllCards,
  executeReadOnlyQuery,
  checkDbHealthy,
  getAllCategories,
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
} from './db.js';
import { generateFileHash, generateTxHash } from './utils.js';
import { parseCSV } from './parser.js';
import { checkHealth, generateSQL, summarizeResults } from './ollama.js';
import { MAX_UPLOAD_SIZE } from './config.js';

/**
 * Light CSV content check — looks for common delimiters / a DATE-like header
 */
function looksLikeCsv(content) {
  if (!content || typeof content !== 'string') return false;
  const sample = content.slice(0, 4096);
  if (!sample.trim()) return false;
  // Accept ~|~ / ~ / comma / tab delimited rows, or lines containing DATE+AMT
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

/**
 * Handle API requests
 */
export async function handleApiRequest(req, url) {
  const { pathname } = url;

  // GET /api/health
  if (pathname === '/api/health' && req.method === 'GET') {
    const dbOk = typeof checkDbHealthy === 'function' ? checkDbHealthy() : true;
    const startedAt = globalThis.__serverStartedAt || Date.now();
    const uptime = Math.floor((Date.now() - startedAt) / 1000);
    return Response.json({
      success: dbOk,
      status: dbOk ? 'ok' : 'degraded',
      db: dbOk,
      uptime,
    }, { status: dbOk ? 200 : 503 });
  }

  // GET /api/cards
  if (pathname === '/api/cards' && req.method === 'GET') {
    try {
      const cards = getAllCards();
      return Response.json({ success: true, cards });
    } catch (error) {
      console.error('Error fetching cards:', error);
      return Response.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }
  }

  // GET /api/transactions
  if (pathname === '/api/transactions' && req.method === 'GET') {
    try {
      const cardId = url.searchParams.get('cardId');
      const transactions = getAllTransactions(cardId ? Number(cardId) : undefined);
      return Response.json({ success: true, transactions });
    } catch (error) {
      console.error('Error fetching transactions:', error);
      return Response.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }
  }

  // POST /api/upload
  if (pathname === '/api/upload' && req.method === 'POST') {
    try {
      const formData = await req.formData();
      const file = formData.get('file');

      if (!file) {
        return Response.json(
          { success: false, error: 'No file provided' },
          { status: 400 }
        );
      }

      const fileName = file.name || '';
      if (!fileName.toLowerCase().endsWith('.csv')) {
        return Response.json(
          { success: false, error: 'File must have a .csv extension' },
          { status: 400 }
        );
      }

      const size = file.size ?? 0;
      if (size > MAX_UPLOAD_SIZE) {
        return Response.json(
          {
            success: false,
            error: `File too large. Maximum upload size is ${Math.round(MAX_UPLOAD_SIZE / 1024 / 1024)} MB`,
          },
          { status: 413 }
        );
      }

      const content = await file.text();

      if (content.length > MAX_UPLOAD_SIZE) {
        return Response.json(
          {
            success: false,
            error: `File too large. Maximum upload size is ${Math.round(MAX_UPLOAD_SIZE / 1024 / 1024)} MB`,
          },
          { status: 413 }
        );
      }

      if (!looksLikeCsv(content)) {
        return Response.json(
          { success: false, error: 'File does not look like a valid CSV statement' },
          { status: 400 }
        );
      }

      const fileHash = generateFileHash(content);
      const existingStatement = checkDuplicateStatement(fileHash);

      if (existingStatement) {
        return Response.json({
          isDuplicate: true,
          existingStatement
        });
      }

      const { transactions, cardInfo } = await parseCSV(content, file.name);

      if (transactions.length === 0) {
        return Response.json(
          { success: false, error: 'No valid transactions found in CSV' },
          { status: 400 }
        );
      }

      const bankName = formData.get('bankName') || cardInfo.bankName;
      const cardLast4 = formData.get('cardLast4') || cardInfo.cardLast4;
      const cardLabel = formData.get('cardLabel') || null;

      if (!bankName || !cardLast4) {
        return Response.json({
          success: false,
          needsCardInfo: true,
          detected: cardInfo,
          transactionCount: transactions.length
        }, { status: 422 });
      }

      const dates = transactions.map(t => new Date(t.date).getTime());
      const periodStart = new Date(Math.min(...dates)).toISOString().split('T')[0];
      const periodEnd = new Date(Math.max(...dates)).toISOString().split('T')[0];

      const { cardId, statementId, newCount, duplicateCount } = runInTransaction(() => {
        const cardId = findOrCreateCard(bankName, cardLast4, cardLabel);
        const statementId = insertStatement(
          file.name,
          fileHash,
          periodStart,
          periodEnd,
          transactions.length,
          cardId
        );
        const getCategoryId = createCategoryMatcher();
        let newCount = 0;

        for (const tx of transactions) {
          newCount += insertTransaction(
            generateTxHash(tx.date, tx.amount, tx.description),
            tx.date,
            tx.amount,
            tx.description,
            tx.isCredit,
            tx.type,
            statementId,
            getCategoryId(tx.description)
          );
        }

        return {
          cardId,
          statementId,
          newCount,
          duplicateCount: transactions.length - newCount,
        };
      });

      return Response.json({
        success: true,
        newCount,
        duplicateCount,
        statementInfo: {
          id: statementId,
          fileName: file.name,
          periodStart,
          periodEnd,
          totalRows: transactions.length
        },
        cardInfo: { bankName, cardLast4, cardId }
      });
    } catch (error) {
      console.error('Error uploading file:', error);
      return Response.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }
  }

  // GET /api/statements
  if (pathname === '/api/statements' && req.method === 'GET') {
    try {
      const statements = getAllStatements();
      return Response.json({ success: true, statements });
    } catch (error) {
      console.error('Error fetching statements:', error);
      return Response.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }
  }

  // DELETE /api/statements/:id
  const deleteMatch = pathname.match(/^\/api\/statements\/(\d+)$/);
  if (deleteMatch && req.method === 'DELETE') {
    try {
      const statementId = parseInt(deleteMatch[1], 10);
      const changes = deleteStatement(statementId);

      if (changes === 0) {
        return Response.json(
          { success: false, error: 'Statement not found' },
          { status: 404 }
        );
      }

      return Response.json({ success: true, deletedCount: changes });
    } catch (error) {
      console.error('Error deleting statement:', error);
      return Response.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }
  }

  // ── Categories ──
  if (pathname === '/api/categories' && req.method === 'GET') {
    try {
      const categories = getAllCategories();
      const rules = getAllCategoryRules();
      return Response.json({ success: true, categories, rules });
    } catch (error) {
      console.error('Error fetching categories:', error);
      return Response.json({ success: false, error: error.message }, { status: 500 });
    }
  }

  if (pathname === '/api/categories' && req.method === 'POST') {
    try {
      const body = await req.json();
      const name = body?.name?.trim();
      if (!name) {
        return Response.json({ success: false, error: 'Name is required' }, { status: 400 });
      }
      const id = createCategory(name, body.color || null, body.icon || null);
      return Response.json({ success: true, id }, { status: 201 });
    } catch (error) {
      console.error('Error creating category:', error);
      const status = /UNIQUE/i.test(error.message) ? 409 : 500;
      return Response.json({ success: false, error: error.message }, { status });
    }
  }

  const categoryMatch = pathname.match(/^\/api\/categories\/(\d+)$/);
  if (categoryMatch && req.method === 'PUT') {
    try {
      const id = parseInt(categoryMatch[1], 10);
      const body = await req.json();
      const changes = updateCategory(id, body || {});
      if (changes === 0) {
        return Response.json({ success: false, error: 'Category not found' }, { status: 404 });
      }
      return Response.json({ success: true });
    } catch (error) {
      console.error('Error updating category:', error);
      return Response.json({ success: false, error: error.message }, { status: 500 });
    }
  }

  if (categoryMatch && req.method === 'DELETE') {
    try {
      const id = parseInt(categoryMatch[1], 10);
      const changes = deleteCategory(id);
      if (changes === 0) {
        return Response.json({ success: false, error: 'Category not found' }, { status: 404 });
      }
      return Response.json({ success: true });
    } catch (error) {
      console.error('Error deleting category:', error);
      return Response.json({ success: false, error: error.message }, { status: 500 });
    }
  }

  if (pathname === '/api/categories/rules' && req.method === 'POST') {
    try {
      const body = await req.json();
      const categoryId = Number(body?.categoryId);
      const pattern = body?.pattern?.trim();
      if (!categoryId || !pattern) {
        return Response.json(
          { success: false, error: 'categoryId and pattern are required' },
          { status: 400 }
        );
      }
      const id = createCategoryRule(categoryId, pattern, Number(body.priority) || 0);
      return Response.json({ success: true, id }, { status: 201 });
    } catch (error) {
      console.error('Error creating rule:', error);
      const status = /UNIQUE/i.test(error.message) ? 409 : 500;
      return Response.json({ success: false, error: error.message }, { status });
    }
  }

  const ruleMatch = pathname.match(/^\/api\/categories\/rules\/(\d+)$/);
  if (ruleMatch && req.method === 'DELETE') {
    try {
      const id = parseInt(ruleMatch[1], 10);
      const changes = deleteCategoryRule(id);
      if (changes === 0) {
        return Response.json({ success: false, error: 'Rule not found' }, { status: 404 });
      }
      return Response.json({ success: true });
    } catch (error) {
      console.error('Error deleting rule:', error);
      return Response.json({ success: false, error: error.message }, { status: 500 });
    }
  }

  if (pathname === '/api/categories/apply-rules' && req.method === 'POST') {
    try {
      const updated = applyCategoryRules();
      return Response.json({ success: true, updated });
    } catch (error) {
      console.error('Error applying rules:', error);
      return Response.json({ success: false, error: error.message }, { status: 500 });
    }
  }

  // PUT /api/transactions/:id/category
  const txCatMatch = pathname.match(/^\/api\/transactions\/(\d+)\/category$/);
  if (txCatMatch && req.method === 'PUT') {
    try {
      const txId = parseInt(txCatMatch[1], 10);
      const body = await req.json();
      const categoryId = body?.categoryId == null ? null : Number(body.categoryId);
      const changes = setTransactionCategory(txId, categoryId, true);
      if (changes === 0) {
        return Response.json({ success: false, error: 'Transaction not found' }, { status: 404 });
      }
      return Response.json({ success: true });
    } catch (error) {
      console.error('Error setting category:', error);
      return Response.json({ success: false, error: error.message }, { status: 500 });
    }
  }

  // GET /api/export
  if (pathname === '/api/export' && req.method === 'GET') {
    try {
      const rows = getTransactionsForExport({
        cardId: url.searchParams.get('cardId'),
        startDate: url.searchParams.get('startDate'),
        endDate: url.searchParams.get('endDate'),
        categoryId: url.searchParams.get('categoryId'),
      });

      const header = ['Date', 'Amount', 'Description', 'Type', 'IsCredit', 'Card', 'Category'];
      const lines = [header.join(',')];
      for (const row of rows) {
        lines.push([
          csvEscape(row.date),
          csvEscape(row.amount),
          csvEscape(row.description),
          csvEscape(row.type),
          csvEscape(row.is_credit ? 'credit' : 'debit'),
          csvEscape(row.card_label || `${row.bank_name || ''} ...${row.card_last4 || ''}`),
          csvEscape(row.category_name || ''),
        ].join(','));
      }

      return new Response(lines.join('\n') + '\n', {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': 'attachment; filename="transactions.csv"',
        },
      });
    } catch (error) {
      console.error('Error exporting:', error);
      return Response.json({ success: false, error: error.message }, { status: 500 });
    }
  }

  // Budgets
  if (pathname === '/api/budgets' && req.method === 'GET') {
    try {
      const now = new Date();
      const yearMonth = url.searchParams.get('month')
        || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      const budgets = getAllBudgets();
      const spend = getCategorySpendForMonth(yearMonth);
      const spendMap = Object.fromEntries(spend.map(s => [s.category_id, s.spent]));
      const enriched = budgets.map(b => ({
        ...b,
        spent: spendMap[b.category_id] || 0,
        yearMonth,
      }));
      return Response.json({ success: true, budgets: enriched, yearMonth });
    } catch (error) {
      console.error('Error fetching budgets:', error);
      return Response.json({ success: false, error: error.message }, { status: 500 });
    }
  }

  if (pathname === '/api/budgets' && req.method === 'POST') {
    try {
      const body = await req.json();
      const categoryId = Number(body?.categoryId);
      const amount = Number(body?.amount);
      if (!categoryId || !Number.isFinite(amount) || amount <= 0) {
        return Response.json(
          { success: false, error: 'categoryId and positive amount are required' },
          { status: 400 }
        );
      }
      const id = upsertBudget(categoryId, amount, body.period || 'monthly');
      return Response.json({ success: true, id });
    } catch (error) {
      console.error('Error upserting budget:', error);
      return Response.json({ success: false, error: error.message }, { status: 500 });
    }
  }

  const budgetMatch = pathname.match(/^\/api\/budgets\/(\d+)$/);
  if (budgetMatch && req.method === 'DELETE') {
    try {
      const categoryId = parseInt(budgetMatch[1], 10);
      const changes = deleteBudget(categoryId);
      if (changes === 0) {
        return Response.json({ success: false, error: 'Budget not found' }, { status: 404 });
      }
      return Response.json({ success: true });
    } catch (error) {
      console.error('Error deleting budget:', error);
      return Response.json({ success: false, error: error.message }, { status: 500 });
    }
  }

  // Recurring
  if (pathname === '/api/recurring' && req.method === 'GET') {
    try {
      const recurring = detectRecurring();
      return Response.json({ success: true, recurring });
    } catch (error) {
      console.error('Error detecting recurring:', error);
      return Response.json({ success: false, error: error.message }, { status: 500 });
    }
  }

  // GET /api/chat/health
  if (pathname === '/api/chat/health' && req.method === 'GET') {
    try {
      const health = await checkHealth();
      return Response.json({ success: true, ...health });
    } catch (error) {
      console.error('Error checking chat health:', error);
      return Response.json(
        { success: false, available: false, error: error.message },
        { status: 500 }
      );
    }
  }

  // POST /api/chat
  if (pathname === '/api/chat' && req.method === 'POST') {
    try {
      const { question } = await req.json();

      if (!question || typeof question !== 'string' || question.trim().length === 0) {
        return Response.json(
          { success: false, error: 'Question is required' },
          { status: 400 }
        );
      }

      if (question.length > 500) {
        return Response.json(
          { success: false, error: 'Question must be 500 characters or less' },
          { status: 400 }
        );
      }

      let sql;
      try {
        sql = await generateSQL(question.trim());
      } catch (error) {
        console.error('SQL generation failed:', error);
        return Response.json(
          { success: false, error: 'Could not generate query. Is Ollama running?' },
          { status: 502 }
        );
      }

      let rows;
      try {
        ({ rows } = executeReadOnlyQuery(sql));
      } catch (error) {
        console.error('Query execution failed:', error, 'SQL:', sql);
        // Do not echo raw SQL in client-facing errors
        return Response.json(
          { success: false, error: 'Query failed. Try rephrasing your question.' },
          { status: 422 }
        );
      }

      let answer;
      try {
        answer = await summarizeResults(question.trim(), sql, rows);
      } catch (error) {
        console.error('Summary generation failed:', error);
        answer = rows.length > 0
          ? `Found ${rows.length} result${rows.length === 1 ? '' : 's'}.`
          : 'No results found for your query.';
      }

      return Response.json({
        success: true,
        answer,
        sql,
        rowCount: rows.length,
        data: rows.slice(0, 50),
      });
    } catch (error) {
      console.error('Error in chat:', error);
      return Response.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }
  }

  return Response.json(
    { success: false, error: 'Not Found' },
    { status: 404 }
  );
}
