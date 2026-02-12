import Papa from 'papaparse';
import { parseDate, parseAmount } from './utils.js';

/**
 * Auto-detect delimiter used in CSV file
 * @param {string} content - Full CSV content
 * @returns {string} - Detected delimiter ('~|~' or '~')
 */
function detectDelimiter(content) {
  const lines = content.split(/\r?\n/);

  // Look for the header row that contains DATE and AMT
  for (const line of lines) {
    if (line.includes('DATE') && line.includes('AMT')) {
      // Check which delimiter is used
      if (line.includes('~|~')) {
        return '~|~';
      } else if (line.includes('~')) {
        return '~';
      }
    }
  }

  // Default to the most common format
  return '~|~';
}

/**
 * Find the line number containing the header row
 * @param {string} content - Full CSV content
 * @returns {number} - Line index of header row (0-based)
 */
function findHeaderRowIndex(content) {
  const lines = content.split(/\r?\n/);

  // Look for row with both DATE and AMT columns (case-insensitive check)
  const headerIndex = lines.findIndex(line => {
    const upperLine = line.toUpperCase();
    return upperLine.includes('DATE') && upperLine.includes('AMT');
  });

  if (headerIndex === -1) {
    throw new Error('Could not find header row with DATE and AMT columns');
  }

  return headerIndex;
}

/**
 * Extract statement metadata from header section
 * @param {string} fileContent - Full CSV content
 * @param {number} headerIndex - Index of header row
 * @returns {object} - { statementDate, periodStart, periodEnd }
 */
export function extractStatementMetadata(fileContent, headerIndex) {
  const lines = fileContent.split(/\r?\n/).slice(0, headerIndex);

  let statementDate = null;

  // Look for "Statement Date" line
  for (const line of lines) {
    if (line.includes('Statement Date')) {
      // Extract date from formats like "Statement Date~23/04/2025" or "Statement Date~|~23/04/2025"
      const match = line.match(/Statement Date.*?(\d{2}\/\d{2}\/\d{4})/);
      if (match) {
        statementDate = match[1];
      }
      break;
    }
  }

  return {
    statementDate: statementDate || 'Unknown',
    // Period will be calculated from first/last transaction dates
  };
}

/**
 * Parse credit card CSV file content
 * @param {string} fileContent - Raw CSV file content
 * @returns {Promise<Array>} - Array of parsed transactions
 */
export async function parseCSV(fileContent) {
  return new Promise((resolve, reject) => {
    try {
      // Auto-detect delimiter
      const delimiter = detectDelimiter(fileContent);

      // Find header row
      const headerIndex = findHeaderRowIndex(fileContent);

      // Split lines and keep from header row onwards
      const lines = fileContent.split(/\r?\n/);
      const processedContent = lines.slice(headerIndex).join('\n');

      // Parse with auto-detected delimiter
      Papa.parse(processedContent, {
        delimiter: delimiter,
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          try {
            // Validate expected columns exist
            const firstRow = results.data[0];
            if (!firstRow || !('AMT' in firstRow) || !('DATE' in firstRow)) {
              reject(new Error(
                `Invalid CSV format. Expected credit card statement with DATE and AMT columns.\n` +
                `Found columns: ${firstRow ? Object.keys(firstRow).join(', ') : 'none'}`
              ));
              return;
            }

            const transformed = transformCreditCardData(results.data);

            if (transformed.length === 0) {
              reject(new Error('No valid transactions found in the CSV file.'));
              return;
            }

            resolve(transformed);
          } catch (error) {
            reject(error);
          }
        },
        error: (err) => {
          reject(new Error('Failed to parse CSV: ' + err.message));
        }
      });
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Transform raw CSV data to normalized transaction format
 * @param {Array} data - Raw parsed CSV rows
 * @returns {Array} - Transformed transactions
 */
function transformCreditCardData(data) {
  return data
    .map(row => {
      try {
        // Parse amount: remove commas and convert to number
        const amountStr = String(row['AMT'] || '').trim();
        if (!amountStr) return null;
        const amount = parseAmount(amountStr);

        // Parse date: DD/MM/YYYY HH:MM:SS format
        const dateStr = String(row['DATE'] || '').trim();
        if (!dateStr) return null;
        const date = parseDate(dateStr);

        // Get description and transaction type
        const description = String(row['Description'] || '').trim();

        // Handle both "Debit /Credit" and "Debit / Credit" (with/without space)
        const debitCreditCol = row['Debit /Credit'] || row['Debit / Credit'] || '';
        const isCredit = String(debitCreditCol).trim() === 'Cr';

        // Validate required fields
        if (!amount || isNaN(amount) || !date) {
          return null;
        }

        return {
          date: date,              // ISO format: YYYY-MM-DD
          amount: amount,
          description: description,
          isCredit: isCredit,
          type: isCredit ? 'Credit' : 'Debit'
        };
      } catch (error) {
        // Skip invalid rows
        console.warn('Skipping invalid row:', error.message);
        return null;
      }
    })
    .filter(row => row !== null); // Remove invalid rows
}
