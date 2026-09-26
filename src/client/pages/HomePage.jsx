import React, { lazy, Suspense, useState } from 'react';
import FileUpload from '../components/FileUpload';
import { filterByCard } from '../utils/dataProcessing.js';
import './HomePage.css';

const Dashboard = lazy(() => import('../components/Dashboard'));

function HomePage({ csvData, loading, error, notification, onFileUpload, onErrorDismiss, onNotificationDismiss, onError, cards }) {
  const [selectedCardId, setSelectedCardId] = useState('all');

  const filteredData = filterByCard(csvData, selectedCardId);

  return (
    <div className="home-page">
      <section className="home-hero">
        <div className="home-hero-copy">
          <span className="eyebrow">Personal finance, simplified</span>
          <h2>Know where every rupee went.</h2>
          <p>Upload a card statement and turn a wall of transactions into a clear picture of your spending.</p>
        </div>
        <div className="home-upload-wrap">
          <FileUpload onFileUpload={onFileUpload} onError={onError} />
          <p className="upload-privacy">CSV only · Processed by your private tracker</p>
        </div>
      </section>

      {loading && (
        <div className="loading-container" role="status">
          <div className="loading-spinner"></div>
          <div className="loading-text">Uploading statement...</div>
          <div className="loading-subtext">Processing and storing transactions</div>
        </div>
      )}

      {error && (
        <div className="error-container" role="alert">
          <div className="error-icon">!</div>
          <div className="error-content">
            <div className="error-title">Upload Failed</div>
            <div className="error-message">{error}</div>
          </div>
          <button
            type="button"
            className="error-close"
            onClick={onErrorDismiss}
            aria-label="Close error"
          >
            ×
          </button>
        </div>
      )}

      {notification && (
        <div className={`notification-container ${notification.type}`} role="status">
          <div className="notification-icon">
            {notification.type === 'success' ? '✓' : 'ⓘ'}
          </div>
          <div className="notification-content">
            <div className="notification-title">{notification.title}</div>
            <div className="notification-message">{notification.message}</div>
            {notification.details && (
              <ul className="notification-details">
                {notification.details.map((detail, idx) => (
                  <li key={idx}>{detail}</li>
                ))}
              </ul>
            )}
          </div>
          <button
            type="button"
            className="notification-close"
            onClick={onNotificationDismiss}
            aria-label="Close notification"
          >
            ×
          </button>
        </div>
      )}

      {cards && cards.length > 1 && (
        <div className="card-filter-bar">
          <label className="card-filter-label" htmlFor="home-card-filter">Card:</label>
          <select
            id="home-card-filter"
            className="card-filter-select"
            value={selectedCardId}
            onChange={e => setSelectedCardId(e.target.value)}
          >
            <option value="all">All Cards</option>
            {cards.map(card => (
              <option key={card.id} value={card.id}>{card.card_label}</option>
            ))}
          </select>
        </div>
      )}

      {filteredData?.length > 0 ? (
        <Suspense fallback={
          <div className="dashboard-loading" role="status">
            <div className="loading-spinner"></div>
            <span>Preparing dashboard...</span>
          </div>
        }>
          <Dashboard csvData={filteredData} />
        </Suspense>
      ) : (
        <div className="dashboard-empty">
          <div className="dashboard-empty-icon" aria-hidden="true">↗</div>
          <div>
            <h3>Your spending overview will appear here</h3>
            <p>Upload a CSV file to see your dashboard.</p>
          </div>
        </div>
      )}
    </div>
  );
}

export default HomePage;
