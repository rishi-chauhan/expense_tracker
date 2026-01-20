import { useState, useEffect } from "react";
import { initializePdfWorker, extractTableData } from "../../utils/pdfUtils";
import {
  ERROR_MESSAGES,
  APP_TITLE,
  LOADING_MESSAGE,
  RESULTS_SUMMARY,
  UPLOAD_PROMPT,
} from "../../utils/constants";
import FileUpload from "../FileUpload/FileUpload";
import TableDisplay from "../TableDisplay/TableDisplay";
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
  const [bank, setBank] = useState("HDFC");

  useEffect(() => {
    try {
      initializePdfWorker();
      console.log("PDF worker initialized");
    } catch (error) {
      console.error(ERROR_MESSAGES.ERROR_INITIALIZING_PDF_WORKER, error);
      setError(ERROR_MESSAGES.ERROR_INITIALIZING_PDF_WORKER + error.message);
    }
  }, []);

  const handleFileSelect = async (file) => {
    try {
      setIsLoading(true);
      setError(null);
      setFileSelected(true);
      setExtractedData({ bank: null, headers: [], rows: [] });
      console.log("Processing file:", file.name);

      const data = await extractTableData(file, bank);

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

  return (
    <div className="app-container">
      <h1>{APP_TITLE}</h1>

      <FileUpload
        onFileSelect={handleFileSelect}
        uploadPrompt={UPLOAD_PROMPT}
      />

      <select value={bank} onChange={(e) => setBank(e.target.value)}>
        <option value="HDFC">HDFC</option>
        <option value="ICICI">ICICI</option>
        {/* Add more banks as needed */}
      </select>

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
        </>
      )}

      {!isLoading && !error && !fileSelected && (
        <div className="initial-prompt">Upload a PDF statement to begin.</div>
      )}
    </div>
  );
}

export default App;
