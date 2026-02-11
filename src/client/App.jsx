import React, { useState, useEffect } from 'react';
import FileUpload from './components/FileUpload';
import Dashboard from './components/Dashboard';
import './App.css';

// API base URL - uses relative path so it works in both dev and production
const API_BASE = '/api';

function App() {
  const [csvData, setCsvData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Load existing transactions on mount
  useEffect(() => {
    async function loadTransactions() {
      try {
        const res = await fetch(`${API_BASE}/transactions`);
        const data = await res.json();

        if (data.success && data.transactions.length > 0) {
          // Transform API data to component format
          const transformed = data.transactions.map(tx => ({
            Date: new Date(tx.date),
            Amount: tx.amount,
            Description: tx.description,
            IsCredit: Boolean(tx.is_credit),
            Type: tx.type
          }));
          setCsvData(transformed);
        }
      } catch (err) {
        console.error('Failed to load transactions:', err);
        // Don't show error on initial load - user may have no data yet
      }
    }
    loadTransactions();
  }, []);

  const handleFileUpload = async (file) => {
    setLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch(`${API_BASE}/upload`, {
        method: 'POST',
        body: formData
      });

      const result = await res.json();

      // Check for duplicate statement
      if (result.isDuplicate) {
        const uploadDate = new Date(result.existingStatement.uploaded_at).toLocaleDateString();
        const message = `This statement was already uploaded on ${uploadDate}.\n\nFile: ${result.existingStatement.file_name}\nPeriod: ${result.existingStatement.period_start} to ${result.existingStatement.period_end}\n\nSkipping duplicate upload.`;
        alert(message);
        setLoading(false);
        return;
      }

      if (!result.success) {
        setError(result.error || 'Upload failed');
        setLoading(false);
        return;
      }

      // Success - reload transactions
      const txRes = await fetch(`${API_BASE}/transactions`);
      const txData = await txRes.json();

      if (txData.success) {
        const transformed = txData.transactions.map(tx => ({
          Date: new Date(tx.date),
          Amount: tx.amount,
          Description: tx.description,
          IsCredit: Boolean(tx.is_credit),
          Type: tx.type
        }));
        setCsvData(transformed);
      }

      // Show success message
      const message = `✅ Upload complete!\n\nAdded: ${result.newCount} new transactions\nSkipped: ${result.duplicateCount} duplicates\n\nStatement period: ${result.statementInfo.periodStart} to ${result.statementInfo.periodEnd}`;
      alert(message);

    } catch (err) {
      setError('Upload failed: ' + err.message);
    } finally {
      setLoading(false);
    }
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
            <div className="loading-text">Uploading statement...</div>
            <div className="loading-subtext">Processing and storing transactions</div>
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