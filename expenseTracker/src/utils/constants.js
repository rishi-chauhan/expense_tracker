export const APP_TITLE = "Expense Tracker"; // Renamed from PDF Table Extractor
export const TABLE_CONSTANTS = {
  TABLE_TITLE: "Extracted Transactions", // More generic title
  // Removed specific TABLE_HEADERS, extraction logic should be more robust
};
export const ERROR_MESSAGES = {
  ERROR_INITIALIZING_PDF_WORKER: "Failed to initialize PDF processor: ",
  ERROR_READING_PDF: "Error reading or processing PDF file.", // Simplified message
  NO_ROWS_FOUND: "No transactions found in the PDF.", // Updated message
  ERROR_NO_TABLE_DATA: "Could not extract structured data from the PDF.", // Updated message
  ERROR_INVALID_ROW: "Skipped potentially invalid row data: ", // Kept for debugging
  INVALID_PDF_FILE: "Invalid file type. Please upload a PDF file.",
  UNSUPPORTED_BANK:
    "Unsupported bank statement format. Only HDFC and ICICI are currently supported.", // New error message
};

export const LOADING_MESSAGE = "Processing PDF..."; // Updated message

export const RESULTS_SUMMARY = "Found {count} transactions."; // Kept as is
export const UPLOAD_PROMPT = "Upload your credit card statement (PDF)"; // Updated prompt

// got deminsions from adobe acrobat reader using measure tool. All the values are in inches
export const TABLE_DIMENSIONS = {
  HDFC: {
    date: 1.32,
    transactionDescription: 4.04,
    featureRewardPoints: 1.25,
    amount: 1.44,
  },
  ICICI: {
    date: 0.55,
    srNo: 0.72,
    transactionDetails: 1.95,
    rewardPoints: 0.51,
    intlAmount: 0.55,
    amount: 0.61,
  },
};
