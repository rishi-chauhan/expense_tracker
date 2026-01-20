import * as pdfjsLib from "pdfjs-dist";
import { ERROR_MESSAGES } from "./constants";

// Set up the worker source for pdf.js
// Make sure the worker file is copied to your public/dist folder or served correctly
const PDF_WORKER_SRC = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

/**
 * Initializes the PDF.js worker.
 * Should be called once when the application loads.
 */
export const initializePdfWorker = () => {
  if (typeof window !== "undefined" && window.document) {
    // Ensure this runs only in the browser
    pdfjsLib.GlobalWorkerOptions.workerSrc = PDF_WORKER_SRC;
    // console.log(`PDF.js worker source set to: ${PDF_WORKER_SRC}`);
  } else {
    console.warn(
      "Skipping PDF worker initialization outside of browser environment."
    );
  }
};

// --- Bank Specific Configuration ---
const BANK_CONFIG = {
  HDFC: {
    name: "HDFC",
    identifiers: ["HDFC Bank", "hdfcbank.com"], // Text likely found on page 1
    tableTitle: "Domestic Transactions", // this will used to find the table start
    tableHeaders: [
      "Date",
      "Transaction Description",
      "Feature Reward Points",
      "Amount (in Rs.)",
    ],
    columns: {
      // Mapping from standard name to actual header name
      date: "Date",
      description: "Transaction Description",
      featureRewardPoints: "Feature Reward Points",
      amount: "Amount (in Rs.)",
    },
  },
  ICICI: {
    name: "ICICI",
    identifiers: ["ICICI Bank", "icicibank.com"], // Text likely found on page 1
    tableTitle: "CREDIT SUMMARY", // ICICI does not have table title, so getting the closest one section heading
    // which contains the table
    tableHeaders: [
      "Date",
      "SerNo.",
      "Transaction Details",
      "Reward Points",
      "Intl. amount",
      "Amount (in₹)",
    ], // Headers to find the table
    columns: {
      // Mapping from standard name to actual header name
      date: "Date",
      description: "Transaction Details",
      amount: "Amount (in Rs.)",
      rewardPoints: "Reward Points",
      internationalAmount: "Intl. amount",
    },
  },
};

// --- Helper Functions ---

/**
 * Groups text items by line based on vertical position.
 * @param {Array} items - Array of text items from pdf.js.
 * @param {number} tolerance - Vertical distance tolerance for items on the same line.
 * @returns {Array<Array>} Array of lines, where each line is an array of text items.
 */
function groupItemsByLine(items, tolerance = 5) {
  if (!items || items.length === 0) return [];

  // Sort items primarily by vertical position (top-to-bottom), then horizontal (left-to-right)
  const sortedItems = items.sort((a, b) => {
    const yDiff = a.transform[5] - b.transform[5]; // Compare y-coordinates
    if (Math.abs(yDiff) > tolerance) {
      return yDiff > 0 ? -1 : 1; // Sort descending by Y
    }
    // If y-coordinates are close, sort by x-coordinate (left-to-right)
    return a.transform[4] - b.transform[4];
  });

  const lines = [];
  let currentLine = [sortedItems[0]];

  for (let i = 1; i < sortedItems.length; i++) {
    const prevItem = sortedItems[i - 1];
    const currentItem = sortedItems[i];

    // Check if items are vertically aligned (within tolerance)
    if (
      Math.abs(currentItem.transform[5] - prevItem.transform[5]) <= tolerance
    ) {
      currentLine.push(currentItem);
    } else {
      // New line detected
      lines.push(currentLine);
      currentLine = [currentItem];
    }
  }
  // Add the last line
  lines.push(currentLine);

  return lines;
}

/**
 * Identifies the bank based on text content from the first page.
 * @param {object} pdfDoc - The loaded PDF document object from pdf.js.
 * @returns {Promise<string|null>} The name of the identified bank (e.g., "HDFC", "ICICI") or null.
 */
/**
 * Parses the amount string, handling 'CR'/'cr' and removing commas.
 * @param {string} amountStr - The amount string from the PDF.
 * @returns {number|null} The parsed amount as a number, or null if invalid.
 */
function parseAmount(amountStr) {
  if (!amountStr || typeof amountStr !== "string") return null;

  const cleanedStr = amountStr.replace(/,/g, "").trim(); // Remove commas
  const isCredit = /(?:Cr|CR)$/i.test(cleanedStr); // Check for 'Cr' or 'CR' at the end, case-insensitive
  const numericPart = cleanedStr.replace(/(?:Cr|CR)$/i, "").trim(); // Remove 'Cr' or "CR"

  const amount = parseFloat(numericPart);

  if (isNaN(amount)) {
    console.warn(`Could not parse amount: ${amountStr}`);
    return null;
  }

  return isCredit ? -amount : amount;
}

/**
 * Finds the line index containing the transaction table headers.
 * @param {Array<Array<object>>} lines - Array of lines (each line is an array of text items).
 * @param {number} tableStartIndex - The line index to start searching from.
 * @param {Array<string>} expectedHeaders - The headers to look for.
 * @returns {number} The index of the header line, or -1 if not found.
 */
function findHeaderLineIndex(lines, tableStartIndex, expectedHeaders) {
  for (let i = tableStartIndex; i < lines.length; i++) {
    const lineText = lines[i]
      .map((item) => item.str.trim())
      .join(" ")
      .toLowerCase();
    // Check if all expected headers are present in the line text
    if (
      expectedHeaders.every((header) => lineText.includes(header.toLowerCase()))
    )
      return i;
  }
  return -1;
}

/**
 * Extracts column indices based on header text.
 * @param {Array} headerLineItems - The text items of the header line.
 * @param {object} columnMapping - The bank's column configuration.
 * @returns {object} An object mapping standard names (Date, Description, Amount) to their column index.
 */
function getColumnIndices(headerLineItems, columnMapping) {
  const indices = { Date: -1, Description: -1, Amount: -1 };
  const headerTexts = headerLineItems.map((item) => item.str.trim());

  for (const standardName in columnMapping) {
    const actualHeader = columnMapping[standardName];
    // Find the index of the actual header text
    const index = headerTexts.findIndex(
      (text) => text.toLowerCase() === actualHeader.toLowerCase()
    );
    if (index !== -1) {
      indices[standardName] = index;
    } else {
      // Try partial match if exact match fails (useful for headers split across items)
      const partialIndex = headerTexts.findIndex((text) =>
        text.toLowerCase().includes(actualHeader.toLowerCase())
      );
      if (partialIndex !== -1) {
        indices[standardName] = partialIndex;
      } else {
        console.warn(`Could not find index for header: ${actualHeader}`);
      }
    }
  }

  // A more robust approach might involve checking item positions (x-coordinates)
  // if headers are consistently split or misaligned. For now, text matching is used.

  if (
    indices.Date === -1 ||
    indices.Description === -1 ||
    indices.Amount === -1
  ) {
    console.error(
      "Failed to map all required columns:",
      indices,
      "using headers:",
      headerTexts
    );
    throw new Error(
      "Could not find all required columns (Date, Description, Amount) in the table header."
    );
  }

  return indices;
}

const getTableStartIndex = (lines, tableTitle) => {
  for (let i = 0; i < lines.length; i++) {
    const lineText = lines[i].map((item) => item.str).join(" ");
    if (lineText.includes(tableTitle)) return i;
  }
  return -1;
};
// --- Main Extraction Logic ---

export const extractTableData = async (file, bankName) => {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer });
  const pdfDoc = await pdf.promise;

  // const bankName = await identifyBank(pdfDoc);
  if (!bankName) {
    throw new Error(ERROR_MESSAGES.UNSUPPORTED_BANK);
  }

  const bankConfig = BANK_CONFIG[bankName];
  let transactions = [];
  const outputHeaders = bankConfig.tableHeaders;

  console.log(`Starting PDF processing for ${bankName}...`);

  for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
    console.log(`Processing page ${pageNum}...`);
    const page = await pdfDoc.getPage(pageNum);
    const textContent = await page.getTextContent();
    const items = textContent.items;
    const lines = groupItemsByLine(items);
    const tableStartIndex = getTableStartIndex(lines, bankConfig.tableTitle);

    if (tableStartIndex === -1) {
      console.log(
        `Transaction table title not found on page ${pageNum}. Skipping page.`
      );
      continue; // Skip page if title isn't found
    }

    // Find the header row for the transaction table
    const headerLineIndex = findHeaderLineIndex(
      lines,
      tableStartIndex,
      bankConfig.tableHeaders
    );

    if (headerLineIndex === -1) {
      console.log(
        `Transaction table headers not found on page ${pageNum}. Skipping page.`
      );
      continue; // Skip page if headers aren't found
    }
    console.log(
      `Found header line at index ${headerLineIndex} on page ${pageNum}.`
    );

    let columnIndices;
    try {
      columnIndices = getColumnIndices(
        lines[headerLineIndex],
        bankConfig.columns
      );
    } catch (error) {
      console.error(
        `Error getting column indices on page ${pageNum}:`,
        error.message
      );
      continue; // Skip page if columns can't be mapped
    }

    // Process lines *after* the header line
    const startRowIndex = headerLineIndex + 1;
    for (let i = startRowIndex; i < lines.length; i++) {
      const lineItems = lines[i];
      const rowTexts = lineItems.map((item) => item.str.trim());

      // Basic check: Does the line seem to have enough columns based on header items?
      // This is a weak check, might need refinement based on actual PDF structure.
      if (
        rowTexts.length <
        Math.max(
          columnIndices.Date,
          columnIndices.Description,
          columnIndices.Amount
        )
      ) {
        // console.warn(`Skipping line ${i}: Fewer items than expected columns. Text: ${rowTexts.join(' ')}`);
        continue;
      }

      const date = rowTexts[columnIndices.Date];
      const description = rowTexts[columnIndices.Description];
      const amountStr = rowTexts[columnIndices.Amount];

      // Validate date format (simple check)
      if (!date || !/^\d{2}\/\d{2}\/\d{4}$/.test(date)) {
        // console.warn(`Skipping line ${i}: Invalid or missing date format. Text: ${rowTexts.join(' ')}`);
        continue; // Skip row if date format is wrong
      }

      const amount = parseAmount(amountStr);

      if (amount === null) {
        // console.warn(`Skipping line ${i}: Invalid or missing amount. Text: ${rowTexts.join(' ')}`);
        continue; // Skip row if amount is invalid
      }

      // Add the extracted transaction
      transactions.push([date, description || "", amount]); // Ensure description is at least an empty string
      // console.log(`Extracted: D=${date}, Desc=${description}, Amt=${amount}`);
    }
  }

  console.log(
    `Found ${transactions.length} potential transactions for ${bankName}.`
  );

  if (transactions.length === 0) {
    // Use a more specific error if possible
    throw new Error(
      ERROR_MESSAGES.NO_ROWS_FOUND + ` (Detected Bank: ${bankName})`
    );
  }

  // Return data with standard headers and the identified bank name
  return { bank: bankName, headers: outputHeaders, rows: transactions };
};
