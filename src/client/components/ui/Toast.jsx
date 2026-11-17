import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import Icon from './Icon';
import IconButton from './IconButton';
import './Toast.css';

/**
 * useToast().show({ type: 'success'|'info'|'error', title, message, details })
 * Success/info auto-dismiss after 5 s; errors stay until dismissed.
 */
const ToastContext = createContext({ show: () => {}, dismiss: () => {} });

const AUTO_DISMISS_MS = 5000;
const ICONS = { success: 'check', info: 'info', error: 'alert' };

function Toast({ toast, onDismiss }) {
  useEffect(() => {
    if (toast.type === 'error') return undefined;
    const t = setTimeout(() => onDismiss(toast.id), toast.duration ?? AUTO_DISMISS_MS);
    return () => clearTimeout(t);
  }, [toast, onDismiss]);

  return (
    <div
      className={`toast toast-${toast.type}`}
      role={toast.type === 'error' ? 'alert' : 'status'}
    >
      <Icon name={ICONS[toast.type] || 'info'} size={18} className="toast-icon" />
      <div className="toast-body">
        {toast.title && <p className="toast-title">{toast.title}</p>}
        {toast.message && <p className="toast-message">{toast.message}</p>}
        {toast.details?.length > 0 && (
          <ul className="toast-details">
            {toast.details.map(d => <li key={d}>{d}</li>)}
          </ul>
        )}
      </div>
      <IconButton icon="close" label="Dismiss notification" size={16} className="toast-close" onClick={() => onDismiss(toast.id)} />
    </div>
  );
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id) => {
    setToasts(list => list.filter(t => t.id !== id));
  }, []);

  const show = useCallback((toast) => {
    const id = nextId.current++;
    setToasts(list => [...list.slice(-3), { type: 'info', ...toast, id }]);
    return id;
  }, []);

  const value = useMemo(() => ({ show, dismiss }), [show, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-region" aria-label="Notifications">
        {toasts.map(t => <Toast key={t.id} toast={t} onDismiss={dismiss} />)}
      </div>
    </ToastContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useToast() {
  return useContext(ToastContext);
}
