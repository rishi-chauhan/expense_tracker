import {
  getAllTransactions,
  getAllStatements,
  checkDuplicateStatement,
  insertStatement,
  insertTransaction,
  deleteStatement,
  getStatistics
} from './db.js';
import { generateFileHash, generateTxHash } from './utils.js';
import { parseCSV } from './parser.js';

/**
 * Handle API requests
 * @param {Request} req - Incoming request
 * @param {URL} url - Parsed URL
 * @returns {Response} - API response
 */
export async function handleApiRequest(req, url) {
  const { pathname } = url;

  // GET /api/transactions - Get all transactions
  if (pathname === '/api/transactions' && req.method === 'GET') {
    try {
      const transactions = getAllTransactions();
      const stats = getStatistics();

      return Response.json({
        success: true,
        transactions,
        stats
      });
    } catch (error) {
      console.error('Error fetching transactions:', error);
      return Response.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }
  }

  // POST /api/upload - Upload CSV file
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

      // Read file content
      const content = await file.text();

      // Check file-level duplicate
      const fileHash = generateFileHash(content);
      const existingStatement = checkDuplicateStatement(fileHash);

      if (existingStatement) {
        return Response.json({
          isDuplicate: true,
          existingStatement
        });
      }

      // Parse CSV
      const transactions = await parseCSV(content);

      if (transactions.length === 0) {
        return Response.json(
          { success: false, error: 'No valid transactions found in CSV' },
          { status: 400 }
        );
      }

      // Calculate statement period
      const dates = transactions.map(t => new Date(t.date).getTime());
      const periodStart = new Date(Math.min(...dates)).toISOString().split('T')[0];
      const periodEnd = new Date(Math.max(...dates)).toISOString().split('T')[0];

      // Insert statement
      const statementId = insertStatement(
        file.name,
        fileHash,
        periodStart,
        periodEnd,
        transactions.length
      );

      // Insert transactions with deduplication
      let newCount = 0;
      let duplicateCount = 0;

      for (const tx of transactions) {
        const txHash = generateTxHash(tx.date, tx.amount, tx.description);
        const changes = insertTransaction(
          txHash,
          tx.date,
          tx.amount,
          tx.description,
          tx.isCredit,
          tx.type,
          statementId
        );

        if (changes > 0) {
          newCount++;
        } else {
          duplicateCount++;
        }
      }

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
        }
      });
    } catch (error) {
      console.error('Error uploading file:', error);
      return Response.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }
  }

  // GET /api/statements - Get all statements
  if (pathname === '/api/statements' && req.method === 'GET') {
    try {
      const statements = getAllStatements();

      return Response.json({
        success: true,
        statements
      });
    } catch (error) {
      console.error('Error fetching statements:', error);
      return Response.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }
  }

  // DELETE /api/statements/:id - Delete a statement
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

      return Response.json({
        success: true,
        deletedCount: changes
      });
    } catch (error) {
      console.error('Error deleting statement:', error);
      return Response.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }
  }

  // 404 - Route not found
  return Response.json(
    { success: false, error: 'Not Found' },
    { status: 404 }
  );
}
