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