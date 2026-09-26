import React, { lazy, Suspense, useState } from 'react';
import { Routes, Route, NavLink } from 'react-router-dom';
import { useTheme } from './contexts/ThemeContext';
import { useSettings } from './contexts/SettingsContext';
import { useTransactions } from './hooks/useTransactions';
import { useUpload } from './hooks/useUpload';
import HomePage from './pages/HomePage';
import CardInfoModal from './components/CardInfoModal';
import './App.css';

const AnalyticsDashboard = lazy(() => import('./pages/AnalyticsDashboard'));
const StatementsPage = lazy(() => import('./pages/StatementsPage'));
const CategoriesPage = lazy(() => import('./pages/CategoriesPage'));
const AskAI = lazy(() => import('./components/AskAI'));

function App() {
  const {
    csvData,
    cards,
    loading: dataLoading,
    error: loadError,
    refetch,
    setError: setLoadError,
  } = useTransactions();

  const {
    loading: uploadLoading,
    error: uploadError,
    setError: setUploadError,
    notification,
    setNotification,
    pendingUpload,
    handleFileUpload,
    handleConfirmUpload,
    handleCancelUpload,
  } = useUpload({ onSuccess: () => refetch() });

  const [aiChatOpen, setAiChatOpen] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const { showCredits, toggleShowCredits } = useSettings();

  const error = uploadError;
  const loading = uploadLoading;

  return (
    <div className="App">
      <header className="app-header">
        <div className="header-content">
          <NavLink to="/" className="app-brand" aria-label="Paisa Kidhar Gaya home">
            <div className="logo-icon">₹</div>
            <div className="header-text">
              <h1 className="app-title">Paisa Kidhar Gaya?!</h1>
              <p className="app-subtitle">Your money, made clear</p>
            </div>
          </NavLink>
          <nav className="header-nav" aria-label="Primary navigation">
            <NavLink to="/" end className="nav-link">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 11.5 12 4l9 7.5v8a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" /></svg>
              <span>Home</span>
            </NavLink>
            <NavLink to="/analytics" className="nav-link">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 19V9m6 10V5m6 14v-7m4 7H2" /></svg>
              <span>Analytics</span>
            </NavLink>
            <NavLink to="/statements" className="nav-link">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h9l3 3v15H6zM9 10h6m-6 4h6m-6 4h4" /></svg>
              <span>Statements</span>
            </NavLink>
            <NavLink to="/categories" className="nav-link">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h7v6H4zm9 0h7v6h-7zM4 13h7v6H4zm9 0h7v6h-7z" /></svg>
              <span>Categories</span>
            </NavLink>
          </nav>
          <div className="header-actions">
          <button
            type="button"
            className={`credits-toggle-btn${showCredits ? ' active' : ''}`}
            onClick={toggleShowCredits}
            aria-pressed={showCredits}
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
            type="button"
            className={`ai-chat-toggle-btn${aiChatOpen ? ' active' : ''}`}
            onClick={() => setAiChatOpen(prev => !prev)}
            aria-pressed={aiChatOpen}
            aria-label="Ask AI about your expenses"
            title="Ask AI"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
          </button>
          <button
            type="button"
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
          </div>
        </div>
      </header>

      <main className="app-main">
        {loadError && (
          <div className="load-error-banner" role="alert">
            <span>Could not load data: {loadError}</span>
            <div className="load-error-actions">
              <button type="button" onClick={() => refetch()}>Retry</button>
              <button type="button" onClick={() => setLoadError(null)} aria-label="Dismiss">×</button>
            </div>
          </div>
        )}

        {dataLoading && !csvData && !loadError && (
          <div className="loading-container initial-load" role="status">
            <div className="loading-spinner"></div>
            <div className="loading-text">Loading your data...</div>
          </div>
        )}

        <Suspense fallback={
          <div className="route-loading" role="status">
            <div className="loading-spinner"></div>
            <span>Loading view...</span>
          </div>
        }>
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
                onErrorDismiss={() => setUploadError(null)}
                onNotificationDismiss={() => setNotification(null)}
                onError={setUploadError}
                cards={cards}
              />
            }
          />
          <Route
            path="/analytics"
            element={
              <AnalyticsDashboard
                csvData={csvData}
                cards={cards}
                onCategoryChange={refetch}
              />
            }
          />
          <Route
            path="/statements"
            element={<StatementsPage onChanged={refetch} />}
          />
          <Route
            path="/categories"
            element={<CategoriesPage csvData={csvData} onChanged={refetch} />}
          />
          </Routes>
        </Suspense>
      </main>

      {pendingUpload && (
        <CardInfoModal
          detected={pendingUpload.detected}
          transactionCount={pendingUpload.transactionCount}
          onConfirm={handleConfirmUpload}
          onCancel={handleCancelUpload}
        />
      )}

      {aiChatOpen && (
        <Suspense fallback={null}>
          <AskAI isOpen onClose={() => setAiChatOpen(false)} />
        </Suspense>
      )}
    </div>
  );
}

export default App;
