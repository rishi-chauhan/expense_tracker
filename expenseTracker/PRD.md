# Product Requirements Document (PRD) for Expense Tracker

**Version:** 1.1
**Last Updated:** 2025-04-23

## Overview
Expense Tracker is a personal finance management application developed with a strong focus on user privacy. The application is designed to help users track their expenses by extracting financial data from their credit card statements (PDF format) and organizing the extracted data efficiently. Users will have the ability to store this data securely on their Google Drive, ensuring that no data is stored on the application's servers.

## Goals and Objectives
### Primary Goals:
1.  **Goal 1: Extract Data from Credit Card Statements (PDF)**
    *   Accurately extract transaction details from a user's uploaded PDF credit card statement.
    *   Parse the data into a structured format (e.g., JSON) for further use.
    *   **Initial Scope:** Support for HDFC and ICICI Bank credit card statements.
2.  **Goal 2: Enable Google Drive Integration**
    *   Allow users to sign in with their Google account.
    *   Save the extracted expense data in a JSON file on the user's Google Drive within a dedicated folder named "Expense Tracker."

### Privacy Focus:
*   **No Data Storage:** The application will not store any user data on its servers. All processing will occur locally or via user-authorized cloud integrations.
*   **Secure Authentication:** Ensure secure OAuth 2.0 flows for Google account integration.
*   **Transparency:** Clearly communicate the privacy-first approach to users.

## Features

### 1. PDF Upload and Data Extraction
*   **File Upload:**
    *   Users can upload their credit card statement in PDF format.
*   **Supported Banks (Initial):**
    *   HDFC Bank
    *   ICICI Bank
*   **Bank Identification:**
    *   The application will attempt to identify the bank by examining the header of the first page of the PDF for the bank's name (either as text or within an image logo).
*   **Data Extraction Logic:**
    *   Based on the identified bank, apply specific parsing rules to locate the transaction table.
    *   **ICICI Bank Statement:**
        *   Identify the table with column headers: `Date`, `SerNo.`, `Transaction Details`, `Reward Points`, `Intl.# amount`, `Amount (in Rs.)`.
        *   Extract data primarily from `Date`, `Transaction Details`, and `Amount (in Rs.)`.
    *   **HDFC Bank Statement:**
        *   Identify the table with column headers: `Date`, `Transaction Description`, `Feature Reward Points`, `Amount (in Rs.)`.
        *   Extract data primarily from `Date`, `Transaction Description`, and `Amount (in Rs.)`.
    *   **Common Rules:**
        *   Skip the first row of the identified transaction table as it typically does not contain actual transaction data.
        *   For the 'Amount' column in both formats: If a value contains "CR" or "cr" (case-insensitive), treat it as a credit and represent the amount as a negative number (e.g., "100.00 CR" becomes `-100.00`). Otherwise, treat it as a debit (positive number).
*   **Output:**
    *   Display the extracted data (Date, Description/Details, Amount) in a user-friendly tabular format within the application.
    *   Prepare the data in a structured JSON format for saving.
*   **Error Handling:**
    *   Notify users if the uploaded PDF is not identified as a supported bank statement format.
    *   Handle errors gracefully during the parsing process.

### 2. Google Drive Integration
*   **Google Account Connection:**
    *   Provide an option for users to securely connect their Google account using OAuth 2.0.
*   **Save to Google Drive:**
    *   Create a folder named "Expense Tracker" on the user's Google Drive (if it does not already exist).
    *   Save the extracted data as a JSON file in the "Expense Tracker" folder.
    *   Use a standardized naming convention for saved files (e.g., `expenses_<bank>_<statement_date>.json`).
*   **File Management:**
    *   Notify users of successful uploads or errors during the file-saving process.

### 3. Privacy and Security
*   **No Server-Side Storage:**
    *   All data processing (e.g., PDF parsing) will occur locally on the user's device or via secure browser-based APIs.
*   **Data Encryption:**
    *   Ensure all data transferred to Google Drive is encrypted during transit using HTTPS.
*   **User Consent:**
    *   Obtain explicit user consent before accessing their Google Drive.

## Non-Functional Requirements
*   **Performance:**
    *   Ensure reasonably fast and reliable PDF parsing with minimal latency.
*   **Compatibility:**
    *   Support for modern web browsers (Chrome, Firefox, Safari, Edge).
*   **Scalability:**
    *   Design the PDF parsing logic to be extensible for future bank formats.
*   **Accessibility:**
    *   Ensure the application is accessible to users with disabilities (WCAG 2.1 compliance).

## User Stories
1.  **As a user with an HDFC or ICICI credit card,** I want to upload my statement in PDF format so that I can see my transactions listed in the app.
2.  **As a user,** I want the app to correctly identify credits (like refunds or payments) and show them appropriately (e.g., as negative amounts) in the transaction list.
3.  **As a user,** I want to connect my Google account to the application so that I can securely save my extracted expense data on my Google Drive.
4.  **As a user,** I want to see a confirmation message after my data is successfully saved to Google Drive so that I know my data is secure.
5.  **As a user,** I want the assurance that the application does not store any of my data, so that I can trust its privacy-first approach.

## Technical Requirements
### PDF Parsing
*   Use libraries like `pdf.js` for client-side PDF text extraction.
*   Implement bank-specific parsing rules:
    *   Rule for identifying HDFC vs. ICICI based on header content.
    *   Rules to locate the correct transaction table based on distinct column headers for each bank.
    *   Logic to skip the first row of the transaction table.
    *   Logic to parse the amount column, handling "CR"/"cr" suffixes to denote negative values.

### Google Drive Integration
*   Use Google API Client Library for JavaScript for creating folders and saving files.
*   Implement OAuth 2.0 for secure authentication and authorization using Google Identity Services.

### Frontend
*   Framework: React.js
*   Features:
    *   File upload component accepting PDFs.
    *   Logic to trigger PDF parsing upon upload.
    *   Data table for displaying extracted transactions.
    *   Google account connection interface (button/flow).
    *   State management for handling extracted data and UI updates.

### Backend (Optional/Minimal)
*   Avoid backend processing for sensitive data if possible. Serverless functions could potentially be used for *non-sensitive* auxiliary tasks if absolutely necessary, but PDF parsing and Drive uploads should aim for client-side implementation.

## Success Metrics
1.  **Accuracy:** >95% accuracy in extracting Date, Description, and Amount (correctly handling credits) for supported HDFC and ICICI statements.
2.  **User Adoption:** The number of users successfully parsing statements and connecting their Google accounts.
3.  **Performance:** Average time taken to parse a typical statement PDF (< 10 seconds).
4.  **Privacy Compliance:** Zero incidents of data leakage or unauthorized data storage.

## Timeline
### Phase 1: Core Functionality (5 Weeks)
*   Implement PDF upload.
*   Develop bank identification logic.
*   Implement HDFC and ICICI specific parsing rules (table finding, row skipping, credit handling).
*   Develop the UI for displaying extracted data.

### Phase 2: Google Drive Integration (3 Weeks)
*   Implement OAuth 2.0 authentication.
*   Develop functionality to save JSON files to Google Drive.

### Phase 3: Testing and Optimization (2 Weeks)
*   Test with various HDFC and ICICI statement examples.
*   Refine parsing rules for accuracy and edge cases.
*   Conduct security and privacy reviews.

### Phase 4: Deployment (1 Week)
*   Deploy the application and monitor user feedback.

## Risks and Mitigation
1.  **PDF Format Variations:**
    *   Risk: Banks might slightly change their PDF statement layouts, breaking parsing rules.
    *   Mitigation: Implement robust parsing logic tolerant to minor variations. Monitor for breakages and update rules quickly. Provide clear error messages if parsing fails.
2.  **PDF Text Extraction Issues:**
    *   Risk: Scanned PDFs or complex layouts might hinder accurate text extraction.
    *   Mitigation: Inform users that text-based (not image-based) PDFs work best. Handle extraction errors gracefully.
3.  **Google API Changes/Limits:**
    *   Risk: Changes in Google Drive API or hitting rate limits.
    *   Mitigation: Stay updated with Google API documentation. Implement error handling and potential retry mechanisms for API calls.
4.  **User Misunderstanding of Privacy:**
    *   Risk: Users may assume data is stored on servers.
    *   Mitigation: Clearly communicate privacy policies and the client-side nature of processing within the application UI and help sections.

## Future Enhancements
*   Add support for more banks.
*   Allow users to manually correct or categorize transactions.
*   Provide visual expense analytics (e.g., charts, graphs).
*   Enable integration with other cloud storage services like Dropbox or OneDrive.
*   Support for other input formats (e.g., CSV).

## Conclusion
Expense Tracker is a privacy-first application designed to empower users to manage their expenses effectively and securely, initially focusing on HDFC and ICICI credit card statements. By focusing on accurate, bank-specific data extraction and seamless Google Drive integration, the application will provide a reliable and user-friendly experience.