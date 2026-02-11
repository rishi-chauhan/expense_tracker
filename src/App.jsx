import React, { useState } from 'react';
import FileUpload from './components/FileUpload';
import Dashboard from './components/Dashboard'; // Import Dashboard component
import Papa from 'papaparse';
import './App.css';

function App() {
  const [csvData, setCsvData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const transformCreditCardData = (data) => {
    return data
      .map(row => {
        // Parse amount: remove commas and convert to number
        const amountStr = String(row['AMT'] || '').trim().replace(/,/g, '');
        const amount = parseFloat(amountStr);

        // Parse date: DD/MM/YYYY HH:MM:SS format
        const dateStr = String(row['DATE'] || '').trim();
        const [datePart] = dateStr.split(' ');
        if (!datePart) return null;

        const [day, month, year] = datePart.split('/');
        const date = new Date(year, month - 1, day);

        // Get description and transaction type
        const description = String(row['Description'] || '').trim();
        const isCredit = String(row['Debit /Credit'] || '').trim() === 'Cr';

        // Validate required fields
        if (!amount || isNaN(amount) || !date || isNaN(date.getTime())) {
          return null;
        }

        return {
          Date: date,
          Amount: amount,
          Description: description,
          IsCredit: isCredit,
          Type: isCredit ? 'Credit' : 'Debit'
        };
      })
      .filter(row => row !== null); // Remove invalid rows
  };

  const handleFileUpload = (file) => {
    setLoading(true);
    setError(null);
    setCsvData(null); // Clear previous data

    // Read file as text first to preprocess
    const reader = new FileReader();

    reader.onload = (e) => {
      const content = e.target.result;
      // Handle both Windows (\r\n) and Unix (\n) line endings
      const lines = content.split(/\r?\n/);

      // Skip first 25 metadata rows
      const processedContent = lines.slice(25).join('\n');

      // Parse the processed content with ~|~ delimiter
      Papa.parse(processedContent, {
        delimiter: '~|~',
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          // Don't fail on parsing errors - footer rows may not match format
          // PapaParse will still return valid transaction rows

          // Validate expected columns exist
          const firstRow = results.data[0];
          if (!firstRow || !('AMT' in firstRow) || !('DATE' in firstRow)) {
            setError('Invalid CSV format. Expected credit card statement with DATE and AMT columns.');
            setLoading(false);
            return;
          }

          const transformed = transformCreditCardData(results.data);

          if (transformed.length === 0) {
            setError('No valid transactions found in the CSV file.');
            setLoading(false);
            return;
          }

          setCsvData(transformed);
          console.log('Parsed CSV Data:', transformed);
          setLoading(false);
          setError('');
        },
        error: (err) => {
          setError('Failed to parse CSV: ' + err.message);
          setLoading(false);
        }
      });
    };

    reader.onerror = () => {
      setError('Failed to read file');
      setLoading(false);
    };

    reader.readAsText(file);
  };

  return (
    <div className="App">
      <header className="app-header">
        <div className="header-content">
          <div className="logo-icon">₹</div>
          <div className="header-text">
            <h1 className="app-title">Expense Tracker</h1>
            <p className="app-subtitle">Analyze your credit card spending patterns</p>
          </div>
        </div>
      </header>

      <main className="app-main">
        <FileUpload onFileUpload={handleFileUpload} />

        {loading && (
          <div className="loading-container">
            <div className="loading-spinner"></div>
            <div className="loading-text">Parsing CSV...</div>
            <div className="loading-subtext">Analyzing your transactions</div>
          </div>
        )}

        {error && (
          <div className="error-container">
            <div className="error-icon">!</div>
            <div className="error-content">
              <div className="error-title">Upload Failed</div>
              <div className="error-message">{error}</div>
            </div>
          </div>
        )}

        {csvData && csvData.length > 0 ? (
          <Dashboard csvData={csvData} />
        ) : (
          csvData && <p>No valid data found in the CSV after parsing.</p>
        )}
      </main>
    </div>
  );
}

export default App;