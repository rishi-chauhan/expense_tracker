# Copilot / AI Agent Instructions for expense_tracker

Quick, focused guidance to help an AI coding agent be productive in this repository.

1. Purpose & Big Picture
- This is a small React + Vite app that extracts transaction rows from bank PDF statements and displays them in a table.
- Main data flow: user uploads a PDF (`FileUpload`) → `extractTableData` (in `src/utils/pdfUtils.js`) parses PDF text via `pdfjs-dist` → results are normalized then rendered by `TableDisplay`.

2. Key files and responsibilities
- `src/main.jsx`: app entry. Mounts `App` via Vite-built bundle.
- `src/components/App/App.jsx`: orchestrates initialization (`initializePdfWorker`) and calls `extractTableData(file, bank)`; controls `isLoading`, `error`, and `extractedData` state.
- `src/components/FileUpload/FileUpload.jsx`: file input and basic client-side type validation (`application/pdf`).
- `src/components/TableDisplay/TableDisplay.jsx`: displays only core columns (Date, Description, Amount). It expects header names to be present or will warn/fail gracefully.
- `src/utils/pdfUtils.js`: core PDF parsing and bank-specific config (`BANK_CONFIG`). Contains helpers for grouping text into lines, finding headers, mapping columns, parsing amounts, and the exported `extractTableData` + `initializePdfWorker` functions.
- `src/utils/constants.js`: human-facing strings, error messages and small layout constants used across the app.
- `package.json`: use `npm run dev` (Vite) for local development, `npm run build` for production build, `npm run preview` to preview a built bundle.

3. Important implementation details & patterns
- Bank-specific parsing: `BANK_CONFIG` (in `pdfUtils.js`) contains per-bank `tableTitle`, `tableHeaders`, and `columns` mapping. Currently supports `HDFC` and `ICICI`.
- Header matching uses case-insensitive string matching and some partial-match fallbacks. Extraction relies on `groupItemsByLine` which clusters PDF text items by their vertical position; small changes in pdf layout can break header detection.
- `TableDisplay` filters columns to the three core headers (`Date`, `Description`, `Amount`) — if those headers are absent the component intentionally shows a helpful message rather than crashing.
- `initializePdfWorker` sets `pdfjsLib.GlobalWorkerOptions.workerSrc` to a CDN path based on `pdfjsLib.version`. If worker loading fails, debugging should check network/console for worker 404s or CSP issues.

4. Conventions & expectations for edits
- Do not change the public function signatures used by `App.jsx`: `initializePdfWorker()` and `extractTableData(file, bank)` — many UI flows expect these exact names and parameters.
- Keep user-facing strings in `src/utils/constants.js` rather than inline.
- Preserve the bank configuration pattern inside `pdfUtils.js` when adding support for new banks: extend `BANK_CONFIG` with `identifiers`, `tableTitle`, `tableHeaders`, and `columns` mapping.
- Favor non-breaking improvements to header detection (e.g., adding tolerant matching or x-coordinate-based heuristics) over replacing the entire approach.

5. Dev / debug commands and tips
- Start dev server: `npm run dev` (uses `vite`).
- Build for production: `npm run build` and preview via `npm run preview`.
- Lint: `npm run lint` (ESLint config at project root).
- Useful browser debugging: open devtools console while uploading a PDF — `App.jsx` logs flow steps and `pdfUtils.js` has many debug console messages (e.g., page processing, header line indices, extracted row counts).

6. Troubleshooting common breakages
- PDFs with non-standard spacing/columns: header detection may fail. Add console logs in `groupItemsByLine` / `findHeaderLineIndex` to inspect `lines` and item `transform` values.
- Missing worker: if you see worker 404/CORS errors, confirm `pdfjs-dist` version and that `PDF_WORKER_SRC` URL (in `pdfUtils.js`) resolves. Consider swapping to a local worker import if CDN is blocked.
- Incorrect amounts or date parsing: `parseAmount` and the simple date regex (expects `DD/MM/YYYY`) are strict — adjust parsing or add fallback heuristics for other formats.

7. When adding features
- Add new bank configs only inside `pdfUtils.js` and include `identifiers` for first-page detection (if you update bank identification later).
- If introducing new UI strings, add them to `src/utils/constants.js` and reuse existing keys.

8. Where to look for tests or additional notes
- No automated tests in the repo; small changelogs or notes are in `copilotSteps.txt`.

If anything here is unclear or you want more examples (e.g., a sample PDF characteristic that fails current parsing), tell me which part to expand or which file to annotate with inline guidance.
# Project Context: Expense Tracker

**Application Name:** Expense Tracker
**Developer:** rishi-chauhan
**Date:** 2025-04-23

**Core Purpose:**
This is a personal finance application designed to help users track their expenses. The primary focus is on user privacy, meaning **no user data should be stored on any application servers.**

**Key Goals & Features:**
1.  **PDF Credit Card Statement Parsing:**
    *   Allow users to upload PDF credit card statements.
    *   **Initial Scope:** Support only **HDFC** and **ICICI** bank statements.
    *   **Bank Identification:** Detect the bank based on header information (text/logo) on the first page.
    *   **Extraction Logic:** Apply bank-specific rules to find the transaction table (using unique column headers), extract Date, Description/Details, and Amount.
    *   **Parsing Rules:** Skip the first row of the transaction table. Handle amounts with "CR" or "cr" as negative values.
2.  **Google Drive Integration:**
    *   Allow users to authenticate securely with their Google account (using OAuth 2.0).
    *   Save the extracted transaction data as a JSON file to the user's Google Drive.
    *   Store these files within a specific folder named "Expense Tracker" on their Google Drive.
3.  **Privacy First:** All processing should ideally happen client-side or directly between the client and Google Drive. Avoid any architecture that requires storing sensitive financial data on intermediate servers.

**Technology Stack:**
*   **Frontend:** React.js
*   **Potential Libraries:**
    *   PDF parsing (e.g., `pdf.js`)
    *   Google API client library for JavaScript (Google Identity Services)

**Instructions for LLM Assistant:**
*   When providing code suggestions or assistance, prioritize client-side solutions for data processing and storage integration.
*   Focus on React best practices for component structure, state management (e.g., handling parsed data), and API interactions.
*   **Parsing Assistance:** Help implement logic to:
    *   Identify the bank (HDFC/ICICI) from the PDF content.
    *   Apply distinct parsing rules based on the identified bank, considering their specific table structures and column headers.
    *   Ensure the first row of the transaction data table is skipped.
    *   Correctly parse the amount column, converting values with "CR"/"cr" to negative numbers.
*   Ensure any code related to Google Drive integration uses secure practices (OAuth 2.0 via Google Identity Services).
*   Remind me if any proposed solution seems to contradict the "no server-side storage" privacy principle.
*   Help implement robust error handling, especially for PDF parsing (different formats, extraction errors) and Google Drive API calls.
*   Assume the target output for extracted data is a structured JSON format containing fields like `date`, `description`, and `amount`.
*   You can take a reference from PRD.md file when confused on what to do or is reqiured.
*   Use the `copilotSteps.txt` to log and track all the changes you have done.