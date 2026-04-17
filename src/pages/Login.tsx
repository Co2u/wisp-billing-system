import React, { useState } from 'react';
import { Lock, User } from 'lucide-react';
import { apiFetch } from '../lib/api';

export default function Login({ onLogin }: { onLogin: () => void }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await apiFetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Login failed');
      }

      localStorage.setItem('token', data.token);
      onLogin();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg)] text-[var(--text)]">
      <div className="w-full max-w-md bento-card">
        <div className="flex flex-col items-center mb-8">
          <div className="bg-[var(--accent-blue)] w-12 h-12 rounded-lg grid place-items-center font-bold text-[var(--bg)] text-xl mb-4">
            W
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">WISP-BMS</h1>
          <p className="text-sm text-[var(--text-dim)] uppercase tracking-wider mt-1">MikroTik System Architect Console</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 bg-[rgba(248,81,73,0.1)] border border-[var(--accent-red)] text-[var(--accent-red)] rounded-md text-sm text-center">
              {error}
            </div>
          )}

          <div className="space-y-1">
            <label className="text-xs font-semibold text-[var(--text-dim)] uppercase">Username</label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-dim)]" size={16} />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-md py-2 pl-10 pr-3 text-sm focus:outline-none focus:border-[var(--accent-blue)] transition-colors"
                placeholder="admin"
                required
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-[var(--text-dim)] uppercase">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-dim)]" size={16} />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-md py-2 pl-10 pr-3 text-sm focus:outline-none focus:border-[var(--accent-blue)] transition-colors"
                placeholder="••••••••"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[var(--accent-blue)] text-[var(--bg)] font-semibold py-2 rounded-md text-sm hover:opacity-90 transition-opacity disabled:opacity-50 mt-6"
          >
            {loading ? 'Authenticating...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}
