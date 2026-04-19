import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Router, Power, PowerOff, RefreshCw, Edit2 } from 'lucide-react';
import { apiFetch } from '../lib/api';

export default function Routers() {
  const [routers, setRouters] = useState<any[]>([]);
  const [statuses, setStatuses] = useState<Record<number, { state: 'loading' | 'connected' | 'disconnected', data?: any }>>({});
  const [syncingId, setSyncingId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRouter, setEditingRouter] = useState<any>(null);
  const [formData, setFormData] = useState({
    name: '',
    host: '',
    port: '8728',
    username: '',
    password: ''
  });

  const formatBytes = (bytes: number) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const fetchRouters = async () => {
    try {
      const res = await apiFetch('/api/routers', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      if (res.ok) {
        const data = await res.json();
        setRouters(data);
      }
    } catch (err) {
      console.error('Failed to fetch routers', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRouters();
  }, []);

  useEffect(() => {
    routers.forEach(router => {
      if (router.is_active) {
        setStatuses(prev => ({ ...prev, [router.id]: { state: 'loading' } }));
        apiFetch(`/api/routers/${router.id}/status`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        })
        .then(res => res.json())
        .then(data => {
          setStatuses(prev => ({ ...prev, [router.id]: { state: data.connected ? 'connected' : 'disconnected', data } }));
        })
        .catch(() => {
          setStatuses(prev => ({ ...prev, [router.id]: { state: 'disconnected' } }));
        });
      } else {
        setStatuses(prev => ({ ...prev, [router.id]: { state: 'disconnected' } }));
      }
    });
  }, [routers]);

  const handleOpenModal = (router: any = null) => {
    if (router) {
      // Edit mode
      setEditingRouter(router);
      setFormData({
        name: router.name,
        host: router.host,
        port: router.port.toString(),
        username: router.username,
        password: '' // Don't pre-fill password for security
      });
    } else {
      // Add mode
      setEditingRouter(null);
      setFormData({
        name: '',
        host: '',
        port: '8728',
        username: '',
        password: ''
      });
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingRouter(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        ...formData,
        port: parseInt(formData.port, 10) || 8728
      };

      const method = editingRouter ? 'PUT' : 'POST';
      const url = editingRouter ? `/api/routers/${editingRouter.id}` : '/api/routers';

      const res = await apiFetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || `Failed to ${editingRouter ? 'update' : 'add'} router`);
      }

      fetchRouters();
      handleCloseModal();
    } catch (err: any) {
      console.error(err);
      alert(`Error: ${err.message}`);
    }
  };

  const handleToggleActive = async (id: number, currentStatus: boolean) => {
    try {
      await apiFetch(`/api/routers/${id}/toggle`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}` 
        },
        body: JSON.stringify({ is_active: !currentStatus })
      });
      fetchRouters();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this router?')) return;
    try {
      const res = await apiFetch(`/api/routers/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to delete router.');
      }
      fetchRouters();
    } catch (err: any) {
      console.error(err);
      alert(err.message);
    }
  };

  const handleSync = async (id: number) => {
    setSyncingId(id);
    try {
      const res = await apiFetch(`/api/routers/${id}/sync`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      if (res.ok) {
        alert('Router data synced successfully! Profiles and secrets have been imported.');
      } else {
        const err = await res.json();
        alert(`Failed to sync: ${err.error}`);
      }
    } catch (err) {
      console.error(err);
      alert('Failed to sync router data.');
    } finally {
      setSyncingId(null);
    }
  };

  return (
    <div className="p-6 flex-1 flex flex-col h-full overflow-hidden relative">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold">MikroTik Routers</h2>
        <button 
          onClick={handleOpenModal}
          className="bg-[var(--accent-blue)] text-[var(--bg)] px-4 py-2 rounded-md text-sm font-semibold flex items-center gap-2 hover:opacity-90 transition-opacity"
        >
          <Plus size={16} />
          Add Router
        </button>
      </div>

      <div className="bento-card flex-1 overflow-hidden p-0 flex flex-col">
        <div className="flex-1 overflow-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-[var(--bg)] sticky top-0 z-10">
              <tr>
                <th className="px-6 py-3 font-semibold text-[var(--text-dim)] uppercase text-xs tracking-wider">Router Name</th>
                <th className="px-6 py-3 font-semibold text-[var(--text-dim)] uppercase text-xs tracking-wider">Host (IP/Domain)</th>
                <th className="px-6 py-3 font-semibold text-[var(--text-dim)] uppercase text-xs tracking-wider">Status</th>
                <th className="px-6 py-3 font-semibold text-[var(--text-dim)] uppercase text-xs tracking-wider">Sync Status</th>
                <th className="px-6 py-3 font-semibold text-[var(--text-dim)] uppercase text-xs tracking-wider">Health Metrics</th>
                <th className="px-6 py-3 font-semibold text-[var(--text-dim)] uppercase text-xs tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-[var(--text-dim)]">Loading routers...</td>
                </tr>
              ) : routers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-[var(--text-dim)]">No routers found.</td>
                </tr>
              ) : (
                routers.map((router) => {
                  const status = statuses[router.id];
                  return (
                    <tr key={router.id} className="hover:bg-[rgba(255,255,255,0.02)] transition-colors">
                      <td className="px-6 py-4 font-medium">{router.name}</td>
                      <td className="px-6 py-4 font-mono text-xs opacity-80">{router.host}</td>
                      <td className="px-6 py-4">
                        <span className={`badge ${router.is_active ? 'badge-active' : 'badge-expired'}`}>
                          {router.is_active ? 'ACTIVE' : 'DISABLED'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          {status?.state === 'loading' && <div className="w-2 h-2 rounded-full bg-[var(--accent-orange)] animate-pulse" title="Checking..." />}
                          {status?.state === 'connected' && <div className="w-2 h-2 rounded-full bg-[var(--accent-green)] shadow-[0_0_8px_var(--accent-green)]" title="Connected" />}
                          {status?.state === 'disconnected' && <div className="w-2 h-2 rounded-full bg-[var(--accent-red)]" title="Disconnected" />}
                          <span className="text-xs text-[var(--text-dim)]">
                            {status?.state === 'loading' ? 'Checking...' : status?.state === 'connected' ? 'Online' : 'Offline'}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {status?.state === 'connected' && status?.data?.cpuLoad !== undefined ? (
                          <div className="flex flex-col gap-1 text-xs">
                            <div className="flex items-center gap-2"><span className="text-[var(--text-dim)] w-8">CPU:</span> <span className="font-mono">{status.data.cpuLoad}%</span></div>
                            <div className="flex items-center gap-2"><span className="text-[var(--text-dim)] w-8">RAM:</span> <span className="font-mono">{formatBytes(status.data.totalMemory - status.data.freeMemory)} / {formatBytes(status.data.totalMemory)}</span></div>
                            <div className="flex items-center gap-2"><span className="text-[var(--text-dim)] w-8">UP:</span> <span className="font-mono">{status.data.uptime}</span></div>
                          </div>
                        ) : (
                          <span className="text-[var(--text-dim)] text-xs">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => handleOpenModal(router)}
                          className="text-[var(--accent-blue)] hover:bg-[rgba(30,144,255,0.1)] p-1.5 rounded transition-colors mr-2"
                          title="Edit Router Details"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button 
                          onClick={() => handleSync(router.id)}
                          disabled={!router.is_active || status?.state !== 'connected' || syncingId === router.id}
                          className="text-[var(--accent-blue)] hover:bg-[rgba(88,166,255,0.1)] p-1.5 rounded transition-colors mr-2 disabled:opacity-50 disabled:cursor-not-allowed"
                          title="Sync Profiles & Secrets"
                        >
                          <RefreshCw size={16} className={syncingId === router.id ? 'animate-spin' : ''} />
                        </button>
                        <button 
                          onClick={() => handleToggleActive(router.id, router.is_active)}
                          className={`${router.is_active ? 'text-[var(--accent-orange)] hover:bg-[rgba(210,153,34,0.1)]' : 'text-[var(--accent-green)] hover:bg-[rgba(63,185,80,0.1)]'} p-1.5 rounded transition-colors mr-2`}
                          title={router.is_active ? 'Disable Router' : 'Enable Router'}
                        >
                          {router.is_active ? <PowerOff size={16} /> : <Power size={16} />}
                        </button>
                        <button 
                          onClick={() => handleDelete(router.id)}
                          className="text-[var(--accent-red)] hover:bg-[rgba(248,81,73,0.1)] p-1.5 rounded transition-colors"
                          title="Delete Router"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bento-card w-full max-w-md shadow-2xl border-[var(--border)]">
            <div className="flex items-center gap-2 mb-6">
              <Router size={18} className="text-[var(--accent-blue)]" />
              <h3 className="text-lg font-semibold">{editingRouter ? 'Edit Router Details' : 'Add MikroTik Router'}</h3>
            </div>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-[var(--text-dim)] uppercase">Router Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-md py-2 px-3 text-sm focus:outline-none focus:border-[var(--accent-blue)] transition-colors"
                  placeholder="e.g. Edge-Router-01"
                  required
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1 col-span-2">
                  <label className="text-xs font-semibold text-[var(--text-dim)] uppercase">Host (IP/Domain)</label>
                  <input
                    type="text"
                    value={formData.host}
                    onChange={(e) => setFormData({...formData, host: e.target.value})}
                    className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-md py-2 px-3 text-sm font-mono focus:outline-none focus:border-[var(--accent-blue)] transition-colors"
                    placeholder="192.168.88.1"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-[var(--text-dim)] uppercase">API Port</label>
                  <input
                    type="number"
                    value={formData.port}
                    onChange={(e) => setFormData({...formData, port: e.target.value})}
                    className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-md py-2 px-3 text-sm font-mono focus:outline-none focus:border-[var(--accent-blue)] transition-colors"
                    placeholder="8728"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-[var(--text-dim)] uppercase">API Username</label>
                <input
                  type="text"
                  value={formData.username}
                  onChange={(e) => setFormData({...formData, username: e.target.value})}
                  className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-md py-2 px-3 text-sm focus:outline-none focus:border-[var(--accent-blue)] transition-colors"
                  placeholder="admin"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-[var(--text-dim)] uppercase">API Password{editingRouter ? ' (Leave blank to keep current)' : ''}</label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({...formData, password: e.target.value})}
                  className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-md py-2 px-3 text-sm focus:outline-none focus:border-[var(--accent-blue)] transition-colors"
                  placeholder="••••••••"
                  required={!editingRouter}
                />
              </div>

              <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-[var(--border)]">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-4 py-2 text-sm font-medium text-[var(--text-dim)] hover:text-[var(--text)] transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-[var(--accent-blue)] text-[var(--bg)] px-4 py-2 rounded-md text-sm font-semibold hover:opacity-90 transition-opacity"
                >
                  {editingRouter ? 'Update Router' : 'Add Router'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
