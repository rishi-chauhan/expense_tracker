import React, { useState, useEffect } from 'react';
import { Routes, Route, NavLink } from 'react-router-dom';
import { useTheme } from './contexts/ThemeContext';
import { useSettings } from './contexts/SettingsContext';
import HomePage from './pages/HomePage';
import AnalyticsDashboard from './pages/AnalyticsDashboard';
import './App.css';

// API base URL - uses relative path so it works in both dev and production
const API_BASE = '/api';

function App() {
  const [csvData, setCsvData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [notification, setNotification] = useState(null); // { type: 'success' | 'info', message: string }

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
    setNotification(null);

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
        setNotification({
          type: 'info',
          title: 'Duplicate Statement',
          message: `This statement was already uploaded on ${uploadDate}.`,
          details: [
            `File: ${result.existingStatement.file_name}`,
            `Period: ${result.existingStatement.period_start} to ${result.existingStatement.period_end}`
          ]
        });
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
      setNotification({
        type: 'success',
        title: 'Upload Complete!',
        message: `Successfully processed ${result.statementInfo.fileName}`,
        details: [
          `Added: ${result.newCount} new transaction${result.newCount !== 1 ? 's' : ''}`,
          `Skipped: ${result.duplicateCount} duplicate${result.duplicateCount !== 1 ? 's' : ''}`,
          `Period: ${result.statementInfo.periodStart} to ${result.statementInfo.periodEnd}`
        ]
      });

    } catch (err) {
      setError('Upload failed: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const { theme, toggleTheme } = useTheme();
  const { showCredits, toggleShowCredits } = useSettings();

  return (
    <div className="App">
      <header className="app-header">
        <div className="header-content">
          <div className="logo-icon">₹</div>
          <div className="header-text">
            <h1 className="app-title">Expense Tracker</h1>
            <p className="app-subtitle">Analyze your credit card spending patterns</p>
          </div>
          <button
            className={`credits-toggle-btn${showCredits ? ' active' : ''}`}
            onClick={toggleShowCredits}
            aria-label={showCredits ? 'Hide credits' : 'Show credits'}
            title={showCredits ? 'Hide credits' : 'Show credits'}
          >
            {showCredits ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <text x="4" y="17" fontSize="16" fill="currentColor" stroke="none" fontWeight="bold">₹</text>
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <text x="4" y="17" fontSize="16" fill="currentColor" stroke="none" fontWeight="bold">₹</text>
                <line x1="4" y1="20" x2="20" y2="4" stroke="currentColor" strokeWidth="2"/>
              </svg>
            )}
          </button>
          <button
            className="theme-toggle-btn"
            onClick={toggleTheme}
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          >
            {theme === 'dark' ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="5"/>
                <line x1="12" y1="1" x2="12" y2="3"/>
                <line x1="12" y1="21" x2="12" y2="23"/>
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                <line x1="1" y1="12" x2="3" y2="12"/>
                <line x1="21" y1="12" x2="23" y2="12"/>
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
              </svg>
            )}
          </button>
          <nav className="header-nav">
            <NavLink to="/" end className="nav-link">Home</NavLink>
            <NavLink to="/analytics" className="nav-link">Analytics</NavLink>
          </nav>
        </div>
      </header>

      <main className="app-main">
        <Routes>
          <Route
            path="/"
            element={
              <HomePage
                csvData={csvData}
                loading={loading}
                error={error}
                notification={notification}
                onFileUpload={handleFileUpload}
                onErrorDismiss={() => setError(null)}
                onNotificationDismiss={() => setNotification(null)}
                onError={setError}
              />
            }
          />
          <Route
            path="/analytics"
            element={<AnalyticsDashboard csvData={csvData} />}
          />
        </Routes>
      </main>
    </div>
  );
}

export default App;
