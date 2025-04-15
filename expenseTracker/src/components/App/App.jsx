import { useState, useEffect } from 'react';
import { initializePdfWorker, extractTableData } from '../../utils/pdfUtils';
import { ERROR_MESSAGES, APP_TITLE, LOADING_MESSAGE, RESULTS_SUMMARY } from '../../utils/constants';
import FileUpload from '../FileUpload/FileUpload';
import TableDisplay from '../TableDisplay/TableDisplay';
import './App.css';

function App() {
  const [tableData, setTableData] = useState({ headers: [], rows: [] });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    try {
      initializePdfWorker();
      console.log('PDF worker initialized');
    } catch (error) {
      console.error(ERROR_MESSAGES.ERROR_INITIALIZING_PDF_WORKER, error);
      setError(ERROR_MESSAGES.ERROR_INITIALIZING_PDF_WORKER + error.message);
    }
  }, []);

  const handleFileSelect = async (file) => {
    try {
      setIsLoading(true);
      setError(null);
      console.log('Processing file:', file.name);

      const data = await extractTableData(file);

      if (data.rows.length > 0) {
        console.log(`Successfully extracted ${data.rows.length} rows of table data`);
        setTableData(data);
      } else {
        throw new Error(ERROR_MESSAGES.NO_ROWS_FOUND);
      }
    } catch (error) {
      console.error('Error processing PDF:', error);
      setError(error.message || ERROR_MESSAGES.ERROR_READING_PDF);
      setTableData({ headers: [], rows: [] });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="app-container">
      <h1>{APP_TITLE}</h1>

      <FileUpload onFileSelect={handleFileSelect} />

      {isLoading && <div className="loading">{LOADING_MESSAGE}</div>}

      {error && !isLoading && (
        <div className="error-message">
          {error}
        </div>
      )}

      {!isLoading && !error && tableData.rows.length > 0 && (
        <>
          <div className="results-summary">
            {RESULTS_SUMMARY.replace('{count}', tableData.rows.length)}
          </div>
          <TableDisplay 
            headers={tableData.headers} 
            rows={tableData.rows} 
          />
        </>
      )}
    </div>
  );
}

export default App;
