import Papa from 'papaparse';
import { parseDate, parseAmount } from './utils.js';

/**
 * Parse credit card CSV file content
 * @param {string} fileContent - Raw CSV file content
 * @returns {Promise<Array>} - Array of parsed transactions
 */
export async function parseCSV(fileContent) {
  return new Promise((resolve, reject) => {
    try {
      // Handle both Windows (\r\n) and Unix (\n) line endings
      const lines = fileContent.split(/\r?\n/);

      // Skip first 25 metadata rows
      const processedContent = lines.slice(25).join('\n');

      // Parse the processed content with ~|~ delimiter
      Papa.parse(processedContent, {
        delimiter: '~|~',
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          try {
            // Validate expected columns exist
            const firstRow = results.data[0];
            if (!firstRow || !('AMT' in firstRow) || !('DATE' in firstRow)) {
              reject(new Error('Invalid CSV format. Expected credit card statement with DATE and AMT columns.'));
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
        const isCredit = String(row['Debit /Credit'] || '').trim() === 'Cr';

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
