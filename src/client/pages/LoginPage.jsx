import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import './LoginPage.css';

export default function LoginPage() {
  const { login } = useAuth();
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!password || busy) return;
    setBusy(true);
    setError(null);
    try {
      await login(password);
    } catch (err) {
      if (err.status === 429) {
        const wait = err.data?.retryAfter;
        setError(wait ? `Too many attempts, try again in ${wait} s` : 'Too many attempts, try again later');
      } else if (err.status === 401) {
        setError('Wrong password');
      } else {
        setError(err.message || 'Could not sign in');
      }
      setPassword('');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="login-page">
      <form className="login-card" onSubmit={onSubmit} aria-labelledby="login-title">
        <div className="login-logo" aria-hidden="true">₹</div>
        <h1 id="login-title" className="login-title">Paisa Kidhar Gaya?!</h1>
        <p className="login-subtitle">Enter your password to continue</p>
        <label className="login-label" htmlFor="login-password">Password</label>
        <input
          id="login-password"
          className="login-input"
          type="password"
          autoComplete="current-password"
          autoFocus
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? 'login-error' : undefined}
        />
        {error && <p id="login-error" className="login-error" role="alert">{error}</p>}
        <button type="submit" className="login-button" disabled={busy || !password}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </main>
  );
}
