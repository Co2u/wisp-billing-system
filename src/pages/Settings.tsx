import React, { useState, useEffect } from 'react';
import { apiFetch } from '../lib/api';

export default function Settings() {
  const [formData, setFormData] = useState({
    username: '',
    full_name: '',
    password: '',
    confirm_password: '',
    grace_period: '7'
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await apiFetch('/api/admin/settings', {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        });
        if (res.ok) {
          const data = await res.json();
          setFormData({
            username: data.username,
            full_name: data.full_name,
            password: '',
            confirm_password: '',
            grace_period: data.grace_period.toString()
          });
        } else {
          const data = await res.json();
          setError(data.error || 'Unable to load settings.');
        }
      } catch (err) {
        console.error('Failed to load settings', err);
        setError('Unable to load settings.');
      } finally {
        setLoading(false);
      }
    };

    fetchSettings();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');

    if (formData.password !== formData.confirm_password) {
      setError('Passwords do not match.');
      return;
    }

    setSaving(true);

    try {
      const payload = {
        username: formData.username,
        full_name: formData.full_name,
        password: formData.password || undefined,
        grace_period: parseInt(formData.grace_period, 10)
      };

      const res = await apiFetch('/api/admin/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to save settings.');
      }

      setMessage('Settings updated successfully.');
      setFormData((current) => ({ ...current, password: '', confirm_password: '' }));
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to save settings.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 flex-1 flex flex-col h-full overflow-hidden relative">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl font-semibold">Admin Settings</h2>
          <p className="text-sm text-[var(--text-dim)]">Update your admin credentials and system grace period.</p>
        </div>
      </div>

      <div className="bento-card flex-1 overflow-auto p-6">
        {loading ? (
          <div className="text-sm text-[var(--text-dim)]">Loading settings...</div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && <div className="text-sm text-[var(--accent-red)]">{error}</div>}
            {message && <div className="text-sm text-[var(--accent-green)]">{message}</div>}

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-[var(--text-dim)] uppercase">Admin Username</label>
                <input
                  type="text"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-md py-2 px-3 text-sm focus:outline-none focus:border-[var(--accent-blue)] transition-colors"
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-[var(--text-dim)] uppercase">Full Name</label>
                <input
                  type="text"
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-md py-2 px-3 text-sm focus:outline-none focus:border-[var(--accent-blue)] transition-colors"
                  required
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-[var(--text-dim)] uppercase">New Password</label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-md py-2 px-3 text-sm focus:outline-none focus:border-[var(--accent-blue)] transition-colors"
                  placeholder="Leave blank to keep existing password"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-[var(--text-dim)] uppercase">Confirm Password</label>
                <input
                  type="password"
                  value={formData.confirm_password}
                  onChange={(e) => setFormData({ ...formData, confirm_password: e.target.value })}
                  className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-md py-2 px-3 text-sm focus:outline-none focus:border-[var(--accent-blue)] transition-colors"
                  placeholder="Repeat new password"
                />
              </div>
            </div>

            <div className="space-y-1 max-w-sm">
              <label className="text-xs font-semibold text-[var(--text-dim)] uppercase">Grace Period (Days)</label>
              <input
                type="number"
                min="0"
                value={formData.grace_period}
                onChange={(e) => setFormData({ ...formData, grace_period: e.target.value })}
                className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-md py-2 px-3 text-sm focus:outline-none focus:border-[var(--accent-blue)] transition-colors"
                required
              />
              <p className="text-xs text-[var(--text-dim)]">Number of days after billing date before invoices are due.</p>
            </div>

            <div className="flex justify-end pt-4 border-t border-[var(--border)]">
              <button
                type="submit"
                disabled={saving}
                className="bg-[var(--accent-blue)] text-[var(--bg)] px-4 py-2 rounded-md text-sm font-semibold hover:opacity-90 transition-opacity"
              >
                {saving ? 'Saving...' : 'Save Settings'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
