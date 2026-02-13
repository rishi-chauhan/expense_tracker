import React from 'react';
import FileUpload from '../components/FileUpload';
import Dashboard from '../components/Dashboard';
import './HomePage.css';

function HomePage({ csvData, loading, error, notification, onFileUpload, onErrorDismiss, onNotificationDismiss, onError }) {
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

      <Dashboard csvData={csvData} />
    </div>
  );
}

export default HomePage;
