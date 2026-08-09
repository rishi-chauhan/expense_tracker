import React, { useState, useRef, useEffect } from 'react';
import { chat, chatHealth } from '../utils/api.js';
import './AskAI.css';

const SUGGESTIONS = [
  'How much did I spend last month?',
  'Top 5 merchants by spending',
  'Total spending on Swiggy',
  'Monthly spending trend',
];

function AskAI({ isOpen, onClose }) {
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState([]);
  const [ollamaStatus, setOllamaStatus] = useState(null);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const checkedHealth = useRef(false);

  useEffect(() => {
    if (isOpen && !checkedHealth.current) {
      checkedHealth.current = true;
      chatHealth()
        .then(data => setOllamaStatus(data.available ?? false))
        .catch(() => setOllamaStatus(false));
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  const handleSubmit = async (text) => {
    const q = (text || question).trim();
    if (!q || loading) return;

    setMessages(prev => [...prev, { role: 'user', text: q }]);
    setQuestion('');
    setLoading(true);

    try {
      const data = await chat(q);
      setMessages(prev => [...prev, {
        role: 'assistant',
        text: data.answer,
        sql: data.sql,
        rowCount: data.rowCount,
      }]);
    } catch (err) {
      setMessages(prev => [...prev, {
        role: 'error',
        text: err.status ? (err.message || 'Something went wrong') : 'Could not reach the server',
        sql: err.data?.sql,
      }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="askai-panel" role="dialog" aria-label="Ask AI about your expenses">
      <div className="askai-header">
        <div className="askai-header-title">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2a8 8 0 0 1 8 8c0 3.1-1.7 5.8-4.3 7.1L12 22l-3.7-4.9C5.7 15.8 4 13.1 4 10a8 8 0 0 1 8-8z"/>
            <circle cx="12" cy="10" r="2"/>
          </svg>
          Ask AI
        </div>
        <button className="askai-close-btn" onClick={onClose} aria-label="Close AI chat">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>

      <div className="askai-messages">
        {ollamaStatus === false && (
          <div className="askai-status-msg">
            AI assistant is not available. Make sure Ollama is running.
          </div>
        )}

        {messages.length === 0 && ollamaStatus !== false && (
          <div className="askai-welcome">
            <p className="askai-welcome-text">Ask me anything about your expenses</p>
            <div className="askai-suggestions">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  className="askai-suggestion-chip"
                  onClick={() => handleSubmit(s)}
                  disabled={loading}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`askai-msg askai-msg-${msg.role}`}>
            <div className="askai-msg-text" style={{ whiteSpace: 'pre-wrap' }}>{msg.text}</div>
            {msg.sql && (
              <details className="askai-sql-details">
                <summary>SQL query{msg.rowCount != null ? ` (${msg.rowCount} rows)` : ''}</summary>
                <pre className="askai-sql-code">{msg.sql}</pre>
              </details>
            )}
          </div>
        ))}

        {loading && (
          <div className="askai-msg askai-msg-assistant">
            <div className="askai-typing">
              <span></span><span></span><span></span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <div className="askai-input-bar">
        <input
          ref={inputRef}
          type="text"
          className="askai-input"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask about your expenses..."
          disabled={loading || ollamaStatus === false}
          maxLength={500}
        />
        <button
          className="askai-send-btn"
          onClick={() => handleSubmit()}
          disabled={loading || !question.trim() || ollamaStatus === false}
          aria-label="Send question"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="22" y1="2" x2="11" y2="13"/>
            <polygon points="22 2 15 22 11 13 2 9 22 2"/>
          </svg>
        </button>
      </div>
    </div>
  );
}

export default AskAI;
