import { useState, useEffect, useCallback } from "react";
import { initializePdfWorker, extractTableData } from "../../utils/pdfUtils";
import { saveToGoogleDrive } from "../../utils/googleDriveUtils";
import {
  ERROR_MESSAGES,
  APP_TITLE,
  LOADING_MESSAGE,
  RESULTS_SUMMARY,
  UPLOAD_PROMPT,
} from "../../utils/constants";
import FileUpload from "../FileUpload/FileUpload";
import TableDisplay from "../TableDisplay/TableDisplay";
import GoogleAuth from "../GoogleAuth/GoogleAuth";
import "./App.css";

function App() {
  const [extractedData, setExtractedData] = useState({
    bank: null,
    headers: [],
    rows: [],
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [fileSelected, setFileSelected] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(null);
  const [saveError, setSaveError] = useState(null);
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [accessToken, setAccessToken] = useState(null);

  useEffect(() => {
    try {
      initializePdfWorker();
      console.log("PDF worker initialized");
    } catch (error) {
      console.error(ERROR_MESSAGES.ERROR_INITIALIZING_PDF_WORKER, error);
      setError(ERROR_MESSAGES.ERROR_INITIALIZING_PDF_WORKER + error.message);
    }
  }, []);

  const handleAuthChange = useCallback((signedIn, profile, token) => {
    setIsSignedIn(signedIn);
    setAccessToken(token);
    setSaveSuccess(null);
    setSaveError(null);
    console.log(
      "Auth status changed:",
      signedIn,
      "User:",
      profile?.name,
      "Token:",
      token ? "Present" : "Absent"
    );
  }, []);

  const handleFileSelect = async (file) => {
    try {
      setIsLoading(true);
      setError(null);
      setFileSelected(true);
      setExtractedData({ bank: null, headers: [], rows: [] });
      setSaveSuccess(null);
      setSaveError(null);
      console.log("Processing file:", file.name);

      const data = await extractTableData(file);

      if (data.rows.length > 0) {
        console.log(
          `Successfully extracted ${data.rows.length} transactions for ${data.bank}`
        );
        setExtractedData(data);
      } else {
        setError(data.error || ERROR_MESSAGES.NO_ROWS_FOUND);
        setExtractedData({ bank: null, headers: [], rows: [] });
      }
    } catch (error) {
      console.error("Error processing PDF:", error);
      setError(error.message || ERROR_MESSAGES.ERROR_READING_PDF);
      setExtractedData({ bank: null, headers: [], rows: [] });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveToDrive = async () => {
    if (!isSignedIn || !accessToken) {
      setSaveError("Please sign in with Google first.");
      return;
    }
    if (extractedData.rows.length === 0 || !extractedData.bank) {
      setSaveError(
        "No data or bank info to save. Please upload and process a PDF first."
      );
      return;
    }

    setIsSaving(true);
    setSaveError(null);
    setSaveSuccess(null);

    try {
      const result = await saveToGoogleDrive(
        extractedData.rows,
        extractedData.headers,
        accessToken,
        extractedData.bank
      );
      setSaveSuccess(
        `File '${result.name}' saved successfully to Google Drive!`
      );
      console.log("Save successful:", result);
    } catch (err) {
      console.error("Error saving to Google Drive:", err);
      setSaveError(`Failed to save: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="app-container">
      <h1>{APP_TITLE}</h1>

      <GoogleAuth onAuthChange={handleAuthChange} />

      <FileUpload
        onFileSelect={handleFileSelect}
        uploadPrompt={UPLOAD_PROMPT}
      />

      {isLoading && <div className="loading">{LOADING_MESSAGE}</div>}
      {error && !isLoading && <div className="error-message">{error}</div>}

      {!isLoading && !error && extractedData.rows.length > 0 && (
        <>
          <div className="results-summary">
            Detected Bank: {extractedData.bank}.{" "}
            {RESULTS_SUMMARY.replace("{count}", extractedData.rows.length)}
          </div>
          <TableDisplay
            headers={extractedData.headers}
            rows={extractedData.rows}
          />

          <div style={{ marginTop: "20px", textAlign: "center" }}>
            <button
              onClick={handleSaveToDrive}
              disabled={!isSignedIn || isSaving || !extractedData.bank}
            >
              {isSaving ? "Saving..." : "Save to Google Drive"}
            </button>
            {!isSignedIn && (
              <p style={{ fontSize: "0.8em", color: "#888", marginTop: "5px" }}>
                (Sign in required to save)
              </p>
            )}
            {isSaving && (
              <div className="loading">Saving data to Google Drive...</div>
            )}
            {saveSuccess && !isSaving && (
              <div
                className="success-message"
                style={{ color: "green", marginTop: "10px" }}
              >
                {saveSuccess}
              </div>
            )}
            {saveError && !isSaving && (
              <div className="error-message" style={{ marginTop: "10px" }}>
                {saveError}
              </div>
            )}
          </div>
        </>
      )}

      {!isLoading && !error && !fileSelected && (
        <div className="initial-prompt">Upload a PDF statement to begin.</div>
      )}
    </div>
  );
}

export default App;
