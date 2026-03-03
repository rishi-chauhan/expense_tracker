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
        <div className="error-container">
          <div className="error-icon">!</div>
          <div className="error-content">
            <div className="error-title">Upload Failed</div>
            <div className="error-message">{error}</div>
          </div>
          <button
            className="error-close"
            onClick={onErrorDismiss}
            aria-label="Close error"
          >
            ×
          </button>
        </div>
      )}

      {notification && (
        <div className={`notification-container ${notification.type}`}>
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
