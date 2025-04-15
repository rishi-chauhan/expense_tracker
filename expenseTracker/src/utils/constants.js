export const APP_TITLE = 'PDF Table Extractor';
export const TABLE_CONSTANTS = {
    TABLE_HEADERS: [
        'Date',
        'Transaction Description',
        'Feature Reward Points',
        'Amount (in Rs.)'
    ],
}
export const ERROR_MESSAGES = {
    ERROR_INITIALIZING_PDF_WORKER: 'Failed to initialize PDF processor: ',
    ERROR_READING_PDF: 'Error reading PDF file',
    NO_ROWS_FOUND: 'No rows were found in the table',
    ERROR_NO_TABLE_DATA: 'No table data found in the PDF',
    ERROR_INVALID_ROW: 'Invalid row skipped: ',
    INVALID_PDF_FILE: 'Invalid file type. Please upload a PDF file.',
}

export const LOADING_MESSAGE = 'Loading PDF content...';

export const RESULTS_SUMMARY = 'Found {count} transactions';
export const UPLOAD_PROMPT = 'Please select a valid PDF file';