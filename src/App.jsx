import React, { useState } from 'react';
import FileUpload from './components/FileUpload';
import Dashboard from './components/Dashboard'; // Import Dashboard component
import Papa from 'papaparse';

function App() {
  const [csvData, setCsvData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleFileUpload = (file) => {
    setLoading(true);
    setError(null);
    setCsvData(null); // Clear previous data

    Papa.parse(file, {
      header: true, // Assuming the first row contains headers
      dynamicTyping: true, // Attempt to convert values to appropriate types
      skipEmptyLines: true, // Skip empty lines in the CSV
      complete: (results) => {
        if (results.errors.length) {
          setError('Error parsing CSV: ' + results.errors[0].message);
          setCsvData(null);
        } else {
          // Filter out rows that are completely empty or have all null/undefined values
          const cleanedData = results.data.filter(row =>
            Object.values(row).some(value => value !== null && value !== undefined && String(value).trim() !== '')
          );
          setCsvData(cleanedData);
          console.log('Parsed CSV Data:', cleanedData);
        }
        setLoading(false);
      },
      error: (err) => {
        setError('Failed to parse CSV: ' + err.message);
        setCsvData(null);
        setLoading(false);
      },
    });
  };

  return (
    <div className="App">
      <h1>Welcome to Expense Tracker</h1>
      <FileUpload onFileUpload={handleFileUpload} />

      {loading && <p>Loading CSV data...</p>}
      {error && <p style={{ color: 'red' }}>Error: {error}</p>}

      {csvData && csvData.length > 0 ? (
        <Dashboard csvData={csvData} />
      ) : (
        csvData && <p>No valid data found in the CSV after parsing.</p>
      )}
    </div>
  );
}

export default App;