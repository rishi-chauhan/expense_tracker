import React, { useState } from 'react';
import FileUpload from '../components/FileUpload';
import Dashboard from '../components/Dashboard';
import { filterByCard } from '../utils/dataProcessing.js';
import './HomePage.css';

function HomePage({ csvData, loading, error, notification, onFileUpload, onErrorDismiss, onNotificationDismiss, onError, cards }) {
  const [selectedCardId, setSelectedCardId] = useState('all');

  const filteredData = filterByCard(csvData, selectedCardId);

  return (
    <div className="home-page">
      <FileUpload onFileUpload={onFileUpload} onError={onError} />

      {loading && (
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <div className="loading-text">Uploading statement...</div>
          <div className="loading-subtext">Processing and storing transactions</div>
        </div>
      )}

      {error && (
        <div className="error-container glass">
          <div className="error-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
          </div>
          <div className="error-content">
            <div className="error-title">Upload Failed</div>
            <div className="error-message">{error}</div>
          </div>
          <button
            className="error-close"
            onClick={onErrorDismiss}
            aria-label="Close error"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>
      )}

      {notification && (
        <div className={`notification-container glass ${notification.type}`}>
          <div className="notification-icon">
            {notification.type === 'success' ? (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
              </svg>
            ) : (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
              </svg>
            )}
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
            className="notification-close"
            onClick={onNotificationDismiss}
            aria-label="Close notification"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>
      )}

      {cards && cards.length > 1 && (
        <div className="card-filter-bar glass">
          <label className="card-filter-label">Card:</label>
          <select
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

      <Dashboard csvData={filteredData} />
    </div>
  );
}

export default HomePage;
