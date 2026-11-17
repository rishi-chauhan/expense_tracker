import React, { lazy, Suspense, useCallback, useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useTransactions } from './hooks/useTransactions';
import { useUpload } from './hooks/useUpload';
import { useAuth } from './contexts/AuthContext';
import { FilterProvider } from './contexts/FilterContext';
import { useToast } from './components/ui/Toast';
import AppShell from './components/layout/AppShell';
import OverviewPage from './pages/OverviewPage';
import UploadDialog from './components/UploadDialog';
import CardInfoModal from './components/CardInfoModal';
import { Card } from './components/ui/Card';
import Button from './components/ui/Button';
import Icon from './components/ui/Icon';
import Skeleton from './components/ui/Skeleton';
import './App.css';

const TransactionsPage = lazy(() => import('./pages/TransactionsPage'));
const AnalyticsDashboard = lazy(() => import('./pages/AnalyticsDashboard'));
const StatementsPage = lazy(() => import('./pages/StatementsPage'));
const CategoriesPage = lazy(() => import('./pages/CategoriesPage'));
const AskAI = lazy(() => import('./components/AskAI'));
const LoginPage = lazy(() => import('./pages/LoginPage'));

function RouteSkeleton() {
  return (
    <div className="page" role="status" aria-label="Loading">
      <Skeleton height={40} width="40%" />
      <Card><Skeleton height={220} /></Card>
    </div>
  );
}

function AuthedApp() {
  const {
    csvData,
    cards,
    loading: dataLoading,
    error: loadError,
    refetch,
    setError: setLoadError,
    version,
  } = useTransactions();
  const toast = useToast();

  const {
    loading: uploading,
    pendingUpload,
    handleFileUpload,
    handleConfirmUpload,
    handleCancelUpload,
  } = useUpload({ onSuccess: refetch, notify: toast.show });

  const [uploadOpen, setUploadOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);

  const upload = useCallback(async (file) => {
    await handleFileUpload(file);
    setUploadOpen(false);
  }, [handleFileUpload]);

  const onUploadError = useCallback((message) => {
    toast.show({ type: 'error', title: 'Not a CSV file', message });
  }, [toast]);

  return (
    <FilterProvider csvData={csvData} cards={cards}>
      <AppShell
        cards={cards}
        onUpload={() => setUploadOpen(true)}
        onFileDrop={upload}
        onAskAI={() => setAiOpen(open => !open)}
        aiOpen={aiOpen}
      >
        {loadError && (
          <Card className="inline-error load-error-banner" role="alert">
            <span className="inline-error-text">
              <Icon name="alert" size={18} />
              Could not load data: {loadError}
            </span>
            <span className="inline-error-actions">
              <Button size="sm" onClick={() => refetch()}>Retry</Button>
              <Button size="sm" variant="ghost" onClick={() => setLoadError(null)} aria-label="Dismiss">Dismiss</Button>
            </span>
          </Card>
        )}

        <Suspense fallback={<RouteSkeleton />}>
          <Routes>
            <Route
              path="/"
              element={(
                <OverviewPage
                  csvData={csvData}
                  loading={dataLoading}
                  dataKey={version}
                  onFileUpload={upload}
                  onUploadError={onUploadError}
                />
              )}
            />
            <Route path="/transactions" element={<TransactionsPage cards={cards} onCategoryChange={refetch} />} />
            <Route path="/analytics" element={<AnalyticsDashboard csvData={csvData} />} />
            <Route path="/statements" element={<StatementsPage onChanged={refetch} onUpload={() => setUploadOpen(true)} />} />
            <Route path="/categories" element={<CategoriesPage onChanged={refetch} />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </AppShell>

      <UploadDialog
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onFile={upload}
        onError={onUploadError}
        loading={uploading}
      />

      {pendingUpload && (
        <CardInfoModal
          detected={pendingUpload.detected}
          transactionCount={pendingUpload.transactionCount}
          onConfirm={handleConfirmUpload}
          onCancel={handleCancelUpload}
        />
      )}

      {aiOpen && (
        <Suspense fallback={null}>
          <AskAI isOpen onClose={() => setAiOpen(false)} />
        </Suspense>
      )}
    </FilterProvider>
  );
}

function App() {
  const { status } = useAuth();
  if (status === 'loading') {
    return <div className="auth-loading" role="status" aria-label="Loading" />;
  }
  if (status === 'anon') {
    return (
      <Suspense fallback={<div className="auth-loading" role="status" aria-label="Loading" />}>
        <LoginPage />
      </Suspense>
    );
  }
  return <AuthedApp />;
}

export default App;
