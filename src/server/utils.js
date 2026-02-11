import crypto from 'crypto';

/**
 * Generate SHA-256 hash of file content for duplicate detection
 * @param {string} content - File content as string
 * @returns {string} - Hex-encoded hash
 */
export function generateFileHash(content) {
  return crypto.createHash('sha256').update(content).digest('hex');
}

/**
 * Generate composite hash for transaction deduplication
 * Uses: Date (normalized to YYYY-MM-DD) + Amount (2 decimals) + Description (lowercase, trimmed)
 * @param {string} date - ISO date string (YYYY-MM-DD)
 * @param {number} amount - Transaction amount
 * @param {string} description - Transaction description
 * @returns {string} - Hex-encoded hash
 */
export function generateTxHash(date, amount, description) {
  // Normalize date to YYYY-MM-DD format
  const dateStr = new Date(date).toISOString().split('T')[0];

  // Normalize amount to 2 decimal places
  const amountStr = amount.toFixed(2);

  // Normalize description: lowercase and trim
  const descStr = description.trim().toLowerCase();

  // Create composite string
  const composite = `${dateStr}|${amountStr}|${descStr}`;

  // Generate hash
  return crypto.createHash('sha256').update(composite).digest('hex');
}

/**
 * Parse DD/MM/YYYY date string to ISO format (YYYY-MM-DD)
 * @param {string} dateStr - Date in DD/MM/YYYY format
 * @returns {string} - Date in ISO format (YYYY-MM-DD)
 */
export function parseDate(dateStr) {
  const [datePart] = dateStr.split(' '); // Handle "DD/MM/YYYY HH:MM:SS" format
  const [day, month, year] = datePart.split('/');

  // Create date and format as ISO string (YYYY-MM-DD)
  const date = new Date(year, month - 1, day);

  if (isNaN(date.getTime())) {
    throw new Error(`Invalid date: ${dateStr}`);
  }

  return date.toISOString().split('T')[0];
}

/**
 * Parse amount string (removes commas, converts to float)
 * @param {string} amountStr - Amount string (e.g., "1,234.56")
 * @returns {number} - Parsed amount
 */
export function parseAmount(amountStr) {
  const cleanStr = String(amountStr).trim().replace(/,/g, '');
  const amount = parseFloat(cleanStr);

  if (isNaN(amount)) {
    throw new Error(`Invalid amount: ${amountStr}`);
  }

  return amount;
}
