import React, { useState, useRef, useEffect } from 'react';
import { chat, chatHealth } from '../utils/api.js';
import Dialog from './ui/Dialog';
import IconButton from './ui/IconButton';
import { useSettings } from '../contexts/SettingsContext';
import { formatINR } from '../utils/dataProcessing.js';
import './AskAI.css';

const SUGGESTIONS = [
  'How much did I spend last month?',
  'Top 5 merchants by spending',
  'Total spending on Swiggy',
  'Monthly spending trend',
];

const reducedMotion = () => typeof window !== 'undefined'
  && typeof window.matchMedia === 'function'
  && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const MONEY_KEY = /amount|total|sum|spent|avg|average|spend/i;

/** Small table of the rows behind an answer (essential when OLLAMA_SUMMARIZE=0). */
function ResultTable({ rows }) {
  const { hideAmounts } = useSettings();
  if (!rows?.length) return null;
  const columns = Object.keys(rows[0]);
  const shown = rows.slice(0, 20);
  const cell = (key, value) => {
    if (typeof value === 'number' && MONEY_KEY.test(key) && !/count|id/i.test(key)) {
      return hideAmounts ? '₹ •••••' : formatINR(value);
    }
    return value == null ? '—' : String(value);
  };
  return (
    <div className="askai-table-wrap">
      <table className="askai-table">
        <thead>
          <tr>{columns.map(c => <th key={c} scope="col">{c.replace(/_/g, ' ')}</th>)}</tr>
        </thead>
        <tbody>
          {shown.map((row, i) => (
            <tr key={i}>
              {columns.map(c => (
                <td key={c} className={typeof row[c] === 'number' ? 'is-num' : undefined}>{cell(c, row[c])}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length > shown.length && <p className="askai-table-more">Showing {shown.length} of {rows.length} rows</p>}
    </div>
  );
}

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
    messagesEndRef.current?.scrollIntoView?.({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'end' });
  }, [messages, loading, isOpen]);

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
        data: data.data,
      }]);
    } catch (err) {
      setMessages(prev => [...prev, {
        role: 'error',
        text: err.status ? (err.message || 'Something went wrong') : 'Could not reach the server',
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
    <Dialog
      open
      onClose={onClose}
      title="Ask AI"
      variant="panel"
      className="askai"
      closeLabel="Close AI chat"
      initialFocusRef={inputRef}
    >
      <div className="askai-messages" role="log" aria-live="polite">
        {ollamaStatus === false && (
          <div className="askai-status-msg" role="status">
            AI assistant is not available. Make sure Ollama is running on the Pi.
          </div>
        )}

        {messages.length === 0 && ollamaStatus !== false && (
          <div className="askai-welcome">
            <p className="askai-welcome-text">Ask a question about your spending in plain words. It is answered on your Pi.</p>
            <div className="askai-suggestions">
              {SUGGESTIONS.map((s) => (
                <button
                  type="button"
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
            <div className="askai-msg-text">{msg.text}</div>
            {msg.role === 'assistant' && <ResultTable rows={msg.data} />}
            {msg.sql && (
              <details className="askai-sql-details">
                <summary>SQL query{msg.rowCount != null ? ` (${msg.rowCount} rows)` : ''}</summary>
                <pre className="askai-sql-code">{msg.sql}</pre>
              </details>
            )}
          </div>
        ))}

        {loading && (
          <div className="askai-msg askai-msg-assistant" role="status" aria-label="Thinking">
            <div className="askai-typing"><span></span><span></span><span></span></div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <form className="askai-input-bar" onSubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
        <input
          ref={inputRef}
          type="text"
          className="input askai-input"
          aria-label="Ask a question about your expenses"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask about your expenses..."
          disabled={loading || ollamaStatus === false}
          maxLength={500}
        />
        <IconButton
          type="submit"
          icon="send"
          label="Send question"
          className="askai-send-btn"
          disabled={loading || !question.trim() || ollamaStatus === false}
        />
      </form>
    </Dialog>
  );
}

export default AskAI;
