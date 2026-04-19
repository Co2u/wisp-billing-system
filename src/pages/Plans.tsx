import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Server } from 'lucide-react';
import { apiFetch } from '../lib/api';

export default function Plans() {
  const [plans, setPlans] = useState<any[]>([]);
  const [routers, setRouters] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<any>(null);
  const [formData, setFormData] = useState({
    name: '',
    mikrotik_profile_name: '',
    speed_limit: '',
    price: '',
    billing_cycle: '30',
    router_id: ''
  });

  const fetchPlans = async () => {
    try {
      const [planRes, routerRes] = await Promise.all([
        apiFetch('/api/plans', { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }),
        apiFetch('/api/routers', { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } })
      ]);

      if (planRes.ok) setPlans(await planRes.json());
      if (routerRes.ok) setRouters(await routerRes.json());
    } catch (err) {
      console.error('Failed to fetch plans or routers', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPlans();
  }, []);

  const handleOpenModal = (plan: any = null) => {
    if (plan) {
      setEditingPlan(plan);
      setFormData({
        name: plan.name,
        mikrotik_profile_name: plan.mikrotik_profile_name,
        speed_limit: plan.speed_limit || '',
        price: plan.price.toString(),
        billing_cycle: plan.billing_cycle.toString(),
        router_id: plan.router_id ? plan.router_id.toString() : ''
      });
    } else {
      setEditingPlan(null);
      setFormData({
        name: '',
        mikrotik_profile_name: '',
        speed_limit: '',
        price: '',
        billing_cycle: '30',
        router_id: ''
      });
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingPlan(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const method = editingPlan ? 'PUT' : 'POST';
      const url = editingPlan ? `/api/plans/${editingPlan.id}` : '/api/plans';
      
      const payload = {
        ...formData,
        price: parseFloat(formData.price),
        billing_cycle: parseInt(formData.billing_cycle, 10),
        router_id: formData.router_id || null
      };

      await apiFetch(url, {
        method,
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}` 
        },
        body: JSON.stringify(payload)
      });
      
      fetchPlans();
      handleCloseModal();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this plan?')) return;
    try {
      const res = await apiFetch(`/api/plans/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to delete plan.');
      }
      fetchPlans();
    } catch (err: any) {
      console.error(err);
      alert(err.message);
    }
  };

  return (
    <div className="p-6 flex-1 flex flex-col h-full overflow-hidden relative">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold">Service Plans</h2>
        <button 
          onClick={() => handleOpenModal()}
          className="bg-[var(--accent-blue)] text-[var(--bg)] px-4 py-2 rounded-md text-sm font-semibold flex items-center gap-2 hover:opacity-90 transition-opacity"
        >
          <Plus size={16} />
          Add Plan
        </button>
      </div>

      <div className="bento-card flex-1 overflow-hidden p-0 flex flex-col">
        <div className="flex-1 overflow-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-[var(--bg)] sticky top-0 z-10">
              <tr>
                <th className="px-6 py-3 font-semibold text-[var(--text-dim)] uppercase text-xs tracking-wider">Plan Name</th>
                <th className="px-6 py-3 font-semibold text-[var(--text-dim)] uppercase text-xs tracking-wider">MikroTik Profile</th>
                <th className="px-6 py-3 font-semibold text-[var(--text-dim)] uppercase text-xs tracking-wider">Speed Limit</th>
                <th className="px-6 py-3 font-semibold text-[var(--text-dim)] uppercase text-xs tracking-wider">Price</th>
                <th className="px-6 py-3 font-semibold text-[var(--text-dim)] uppercase text-xs tracking-wider">Billing Cycle</th>
                <th className="px-6 py-3 font-semibold text-[var(--text-dim)] uppercase text-xs tracking-wider">Router</th>
                <th className="px-6 py-3 font-semibold text-[var(--text-dim)] uppercase text-xs tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-[var(--text-dim)]">Loading plans...</td>
                </tr>
              ) : plans.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-[var(--text-dim)]">No plans found.</td>
                </tr>
              ) : (
                plans.map((plan) => (
                  <tr key={plan.id} className="hover:bg-[rgba(255,255,255,0.02)] transition-colors">
                    <td className="px-6 py-4 font-medium">{plan.name}</td>
                    <td className="px-6 py-4 font-mono text-xs opacity-80">{plan.mikrotik_profile_name}</td>
                    <td className="px-6 py-4 font-mono text-xs">{plan.speed_limit || 'Unlimited'}</td>
                    <td className="px-6 py-4 text-[var(--accent-green)] font-semibold">₱{plan.price.toFixed(2)}</td>
                    <td className="px-6 py-4 text-[var(--text-dim)]">{plan.billing_cycle} Days</td>
                    <td className="px-6 py-4 text-sm text-[var(--text-dim)]">{plan.router_name || 'All Routers'}</td>
                    <td className="px-6 py-4 text-right">
                      <button 
                        onClick={() => handleOpenModal(plan)}
                        className="text-[var(--accent-blue)] hover:bg-[rgba(88,166,255,0.1)] p-1.5 rounded transition-colors mr-2"
                        title="Edit Plan"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button 
                        onClick={() => handleDelete(plan.id)}
                        className="text-[var(--accent-red)] hover:bg-[rgba(248,81,73,0.1)] p-1.5 rounded transition-colors"
                        title="Delete Plan"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))
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
              <Server size={18} className="text-[var(--accent-blue)]" />
              <h3 className="text-lg font-semibold">{editingPlan ? 'Edit Plan' : 'New Service Plan'}</h3>
            </div>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-[var(--text-dim)] uppercase">Plan Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-md py-2 px-3 text-sm focus:outline-none focus:border-[var(--accent-blue)] transition-colors"
                  placeholder="e.g. Pro 50Mbps"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-[var(--text-dim)] uppercase">MikroTik Profile Name</label>
                <input
                  type="text"
                  value={formData.mikrotik_profile_name}
                  onChange={(e) => setFormData({...formData, mikrotik_profile_name: e.target.value})}
                  className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-md py-2 px-3 text-sm font-mono focus:outline-none focus:border-[var(--accent-blue)] transition-colors"
                  placeholder="e.g. pro_50m"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-[var(--text-dim)] uppercase">Router</label>
                <select
                  value={formData.router_id}
                  onChange={(e) => setFormData({ ...formData, router_id: e.target.value })}
                  className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-md py-2 px-3 text-sm focus:outline-none focus:border-[var(--accent-blue)] transition-colors"
                >
                  <option value="">All Routers (Global Plan)</option>
                  {routers.map(router => (
                    <option key={router.id} value={router.id}>{router.name} ({router.host})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-[var(--text-dim)] uppercase">Speed Limit</label>
                  <input
                    type="text"
                    value={formData.speed_limit}
                    onChange={(e) => setFormData({...formData, speed_limit: e.target.value})}
                    className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-md py-2 px-3 text-sm font-mono focus:outline-none focus:border-[var(--accent-blue)] transition-colors"
                    placeholder="e.g. 50M/50M"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-[var(--text-dim)] uppercase">Price (₱)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.price}
                    onChange={(e) => setFormData({...formData, price: e.target.value})}
                    className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-md py-2 px-3 text-sm focus:outline-none focus:border-[var(--accent-blue)] transition-colors"
                    placeholder="0.00"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-[var(--text-dim)] uppercase">Billing Cycle (Days)</label>
                <input
                  type="number"
                  value={formData.billing_cycle}
                  onChange={(e) => setFormData({...formData, billing_cycle: e.target.value})}
                  className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-md py-2 px-3 text-sm focus:outline-none focus:border-[var(--accent-blue)] transition-colors"
                  placeholder="30"
                  required
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
                  {editingPlan ? 'Save Changes' : 'Create Plan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
