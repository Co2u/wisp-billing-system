import React, { useState, useEffect } from 'react';
import { Search, Plus, ShieldAlert, ShieldCheck, UserPlus, Trash2, Edit2 } from 'lucide-react';
import { apiFetch } from '../lib/api';

export default function Subscribers() {
  const [subscribers, setSubscribers] = useState<any[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  const [routers, setRouters] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRouterId, setSelectedRouterId] = useState<number | null>(null);
  const [formData, setFormData] = useState({
    full_name: '',
    address: '',
    contact_number: '',
    username: '',
    password: '',
    plan_id: '',
    remote_address: '',
    router_id: '',
    billing_date: ''
  });

  const fetchData = async () => {
    try {
      const headers = { Authorization: `Bearer ${localStorage.getItem('token')}` };
      
      const [subRes, planRes, routerRes] = await Promise.all([
        apiFetch('/api/subscribers', { headers }),
        apiFetch('/api/plans', { headers }),
        apiFetch('/api/routers', { headers })
      ]);

      if (subRes.ok) setSubscribers(await subRes.json());
      if (planRes.ok) setPlans(await planRes.json());
      if (routerRes.ok) {
        const routerData = await routerRes.json();
        setRouters(routerData);
        // Set first router as selected by default
        if (routerData.length > 0 && selectedRouterId === null) {
          setSelectedRouterId(routerData[0].id);
        }
      }
    } catch (err) {
      console.error('Failed to fetch data', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSuspend = async (id: number) => {
    try {
      await apiFetch('/api/enforcement/suspend', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}` 
        },
        body: JSON.stringify({ subscriber_id: id })
      });
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleRestore = async (id: number) => {
    try {
      await apiFetch('/api/enforcement/restore', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}` 
        },
        body: JSON.stringify({ subscriber_id: id })
      });
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this subscriber? This will also remove them from the MikroTik router and delete all associated invoices.')) return;
    try {
      const res = await apiFetch(`/api/subscribers/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to delete subscriber.');
      }
      fetchData();
    } catch (err: any) {
      console.error(err);
      alert(err.message);
    }
  };

  const handleOpenModal = (subscriber: any = null) => {
    setErrorMsg('');
    if (subscriber) {
      // Edit mode
      setEditingId(subscriber.id);
      setFormData({
        full_name: subscriber.full_name,
        address: subscriber.address || '',
        contact_number: subscriber.contact_number || '',
        username: subscriber.username,
        password: '', // Don't pre-fill password for security
        plan_id: subscriber.plan_id.toString(),
        remote_address: subscriber.remote_address,
        router_id: subscriber.router_id.toString(),
        billing_date: subscriber.billing_date ? subscriber.billing_date.split('T')[0] : ''
      });
    } else {
      // Add mode
      setEditingId(null);
      setFormData({
        full_name: '',
        address: '',
        contact_number: '',
        username: '',
        password: '',
        plan_id: plans.length > 0 ? plans[0].id.toString() : '',
        remote_address: '',
        router_id: routers.length > 0 ? routers[0].id.toString() : '',
        billing_date: ''
      });
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingId(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    try {
      const payload = {
        ...formData,
        plan_id: parseInt(formData.plan_id, 10),
        router_id: parseInt(formData.router_id, 10),
        billing_date: formData.billing_date || null
      };

      if (editingId) {
        // Update existing subscriber
        const res = await apiFetch(`/api/subscribers/${editingId}`, {
          method: 'PUT',
          headers: { 
            'Content-Type': 'application/json',
            Authorization: `Bearer ${localStorage.getItem('token')}` 
          },
          body: JSON.stringify(payload)
        });
        
        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || 'Failed to update subscriber');
        }
      } else {
        // Create new subscriber
        const res = await apiFetch('/api/subscribers', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            Authorization: `Bearer ${localStorage.getItem('token')}` 
          },
          body: JSON.stringify(payload)
        });
        
        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || 'Failed to create subscriber');
        }
      }

      fetchData();
      handleCloseModal();
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message);
    }
  };

  const filteredSubscribers = subscribers.filter(sub => {
    const matchesSearch = sub.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         sub.username?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         sub.remote_address?.includes(searchQuery);
    const matchesRouter = selectedRouterId === null || sub.router_id === selectedRouterId;
    return matchesSearch && matchesRouter;
  });

  return (
    <div className="p-6 flex-1 flex flex-col h-full overflow-hidden relative">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold">Subscribers</h2>
        <button 
          onClick={handleOpenModal}
          className="bg-[var(--accent-blue)] text-[var(--bg)] px-4 py-2 rounded-md text-sm font-semibold flex items-center gap-2 hover:opacity-90 transition-opacity"
        >
          <Plus size={16} />
          Add Subscriber
        </button>
      </div>

      <div className="bento-card flex-1 overflow-hidden p-0 flex flex-col">
        {/* Router Tabs */}
        <div className="border-b border-[var(--border)]">
          <div className="flex overflow-x-auto">
            <button
              onClick={() => setSelectedRouterId(null)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                selectedRouterId === null
                  ? 'border-[var(--accent-blue)] text-[var(--accent-blue)]'
                  : 'border-transparent text-[var(--text-dim)] hover:text-[var(--text)]'
              }`}
            >
              All Routers ({subscribers.length})
            </button>
            {routers.filter(router => router.is_active).map((router) => {
              const routerSubscribers = subscribers.filter(sub => sub.router_id === router.id);
              const isSelected = selectedRouterId === router.id;
              return (
                <button
                  key={router.id}
                  onClick={() => setSelectedRouterId(router.id)}
                  className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                    isSelected
                      ? 'border-[var(--accent-blue)] text-[var(--accent-blue)]'
                      : 'border-transparent text-[var(--text-dim)] hover:text-[var(--text)]'
                  }`}
                >
                  {router.name} ({routerSubscribers.length})
                </button>
              );
            })}
          </div>
        </div>

        <div className="p-4 border-b border-[var(--border)] flex gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-dim)]" size={16} />
            <input 
              type="text" 
              placeholder="Search by name, IP, or username..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-md py-2 pl-10 pr-4 text-sm focus:outline-none focus:border-[var(--accent-blue)] transition-colors"
            />
          </div>
        </div>

        <div className="flex-1 overflow-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-[var(--bg)] sticky top-0 z-10">
              <tr>
                <th className="px-6 py-3 font-semibold text-[var(--text-dim)] uppercase text-xs tracking-wider">Name</th>
                <th className="px-6 py-3 font-semibold text-[var(--text-dim)] uppercase text-xs tracking-wider">PPPoE User</th>
                <th className="px-6 py-3 font-semibold text-[var(--text-dim)] uppercase text-xs tracking-wider">IP Address</th>
                <th className="px-6 py-3 font-semibold text-[var(--text-dim)] uppercase text-xs tracking-wider">Router</th>
                <th className="px-6 py-3 font-semibold text-[var(--text-dim)] uppercase text-xs tracking-wider">Plan</th>
                <th className="px-6 py-3 font-semibold text-[var(--text-dim)] uppercase text-xs tracking-wider">Billing Date</th>
                <th className="px-6 py-3 font-semibold text-[var(--text-dim)] uppercase text-xs tracking-wider">Status</th>
                <th className="px-6 py-3 font-semibold text-[var(--text-dim)] uppercase text-xs tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-8 text-center text-[var(--text-dim)]">Loading subscribers...</td>
                </tr>
              ) : filteredSubscribers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-8 text-center text-[var(--text-dim)]">No subscribers found.</td>
                </tr>
              ) : (
                filteredSubscribers.map((sub) => (
                  <tr key={sub.id} className="hover:bg-[rgba(255,255,255,0.02)] transition-colors">
                    <td className="px-6 py-4 font-medium">{sub.full_name}</td>
                    <td className="px-6 py-4 font-mono text-xs opacity-80">{sub.username}</td>
                    <td className="px-6 py-4 font-mono text-xs text-[var(--accent-blue)]">{sub.remote_address}</td>
                    <td className="px-6 py-4 text-sm">
                      {sub.router_name || 'Unknown'}
                    </td>
                    <td className="px-6 py-4">{sub.plan_name || 'Default'}</td>
                    <td className="px-6 py-4 text-[var(--text-dim)]">{sub.billing_date ? new Date(sub.billing_date).toLocaleDateString() : 'N/A'}</td>
                    <td className="px-6 py-4">
                      <span className={`badge ${sub.status === 'ACTIVE' ? 'badge-active' : 'badge-expired'}`}>
                        {sub.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button 
                        onClick={() => handleOpenModal(sub)}
                        className="text-[var(--accent-blue)] hover:bg-[rgba(30,144,255,0.1)] p-1.5 rounded transition-colors"
                        title="Edit Subscriber"
                      >
                        <Edit2 size={16} />
                      </button>
                      {sub.status === 'ACTIVE' ? (
                        <button 
                          onClick={() => handleSuspend(sub.id)}
                          className="text-[var(--accent-orange)] hover:bg-[rgba(210,153,34,0.1)] p-1.5 rounded transition-colors"
                          title="Suspend (Add to EXPIRED)"
                        >
                          <ShieldAlert size={16} />
                        </button>
                      ) : (
                        <button 
                          onClick={() => handleRestore(sub.id)}
                          className="text-[var(--accent-green)] hover:bg-[rgba(63,185,80,0.1)] p-1.5 rounded transition-colors"
                          title="Restore (Remove from EXPIRED)"
                        >
                          <ShieldCheck size={16} />
                        </button>
                      )}
                      <button 
                        onClick={() => handleDelete(sub.id)}
                        className="text-[var(--accent-red)] hover:bg-[rgba(248,81,73,0.1)] p-1.5 rounded transition-colors ml-2"
                        title="Delete Subscriber"
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
          <div className="bento-card w-full max-w-2xl shadow-2xl border-[var(--border)] max-h-[90vh] overflow-y-auto">
            <div className="flex items-center gap-2 mb-6">
              <UserPlus size={18} className="text-[var(--accent-blue)]" />
              <h3 className="text-lg font-semibold">{editingId ? 'Edit Subscriber Details' : 'Add New Subscriber'}</h3>
            </div>
            
            <form onSubmit={handleSubmit} className="space-y-6">
              {errorMsg && (
                <div className="bg-[rgba(248,81,73,0.1)] border border-[var(--accent-red)] text-[var(--accent-red)] px-4 py-3 rounded-md text-sm">
                  {errorMsg}
                </div>
              )}
              {(plans.length === 0 || routers.length === 0) && (
                <div className="bg-[rgba(210,153,34,0.1)] border border-[var(--accent-orange)] text-[var(--accent-orange)] px-4 py-3 rounded-md text-sm">
                  You must create at least one Service Plan and one MikroTik Router before adding a subscriber.
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1 col-span-2">
                  <label className="text-xs font-semibold text-[var(--text-dim)] uppercase">Full Name</label>
                  <input
                    type="text"
                    value={formData.full_name}
                    onChange={(e) => setFormData({...formData, full_name: e.target.value})}
                    className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-md py-2 px-3 text-sm focus:outline-none focus:border-[var(--accent-blue)] transition-colors"
                    placeholder="John Doe"
                    required
                  />
                </div>

                <div className="space-y-1 col-span-2">
                  <label className="text-xs font-semibold text-[var(--text-dim)] uppercase">Address</label>
                  <input
                    type="text"
                    value={formData.address}
                    onChange={(e) => setFormData({...formData, address: e.target.value})}
                    className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-md py-2 px-3 text-sm focus:outline-none focus:border-[var(--accent-blue)] transition-colors"
                    placeholder="123 Main St"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-[var(--text-dim)] uppercase">Contact Number</label>
                  <input
                    type="text"
                    value={formData.contact_number}
                    onChange={(e) => setFormData({...formData, contact_number: e.target.value})}
                    className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-md py-2 px-3 text-sm focus:outline-none focus:border-[var(--accent-blue)] transition-colors"
                    placeholder="+1 234 567 890"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-[var(--text-dim)] uppercase">IP Address (Remote)</label>
                  <input
                    type="text"
                    value={formData.remote_address}
                    onChange={(e) => setFormData({...formData, remote_address: e.target.value})}
                    className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-md py-2 px-3 text-sm font-mono focus:outline-none focus:border-[var(--accent-blue)] transition-colors"
                    placeholder="10.0.0.100"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-[var(--text-dim)] uppercase">PPPoE Username</label>
                  <input
                    type="text"
                    value={formData.username}
                    onChange={(e) => setFormData({...formData, username: e.target.value})}
                    className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-md py-2 px-3 text-sm font-mono focus:outline-none focus:border-[var(--accent-blue)] transition-colors"
                    placeholder="john.doe"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-[var(--text-dim)] uppercase">PPPoE Password{editingId ? ' (Leave blank to keep current)' : ''}</label>
                  <input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({...formData, password: e.target.value})}
                    className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-md py-2 px-3 text-sm focus:outline-none focus:border-[var(--accent-blue)] transition-colors"
                    placeholder="••••••••"
                    required={!editingId}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-[var(--text-dim)] uppercase">Service Plan</label>
                  <select
                    value={formData.plan_id}
                    onChange={(e) => setFormData({...formData, plan_id: e.target.value})}
                    className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-md py-2 px-3 text-sm focus:outline-none focus:border-[var(--accent-blue)] transition-colors"
                    required
                  >
                    <option value="" disabled>Select a plan...</option>
                    {plans.map(plan => (
                      <option key={plan.id} value={plan.id}>{plan.name} ({plan.speed_limit})</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-[var(--text-dim)] uppercase">MikroTik Router</label>
                  <select
                    value={formData.router_id}
                    onChange={(e) => setFormData({...formData, router_id: e.target.value})}
                    className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-md py-2 px-3 text-sm focus:outline-none focus:border-[var(--accent-blue)] transition-colors"
                    required
                  >
                    <option value="" disabled>Select a router...</option>
                    {routers.map(router => (
                      <option key={router.id} value={router.id}>{router.name} ({router.host})</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1 col-span-2">
                  <label className="text-xs font-semibold text-[var(--text-dim)] uppercase">Billing Date</label>
                  <input
                    type="date"
                    value={formData.billing_date}
                    onChange={(e) => setFormData({...formData, billing_date: e.target.value})}
                    className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-md py-2 px-3 text-sm focus:outline-none focus:border-[var(--accent-blue)] transition-colors"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-[var(--border)]">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-4 py-2 text-sm font-medium text-[var(--text-dim)] hover:text-[var(--text)] transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={plans.length === 0 || routers.length === 0}
                  className="bg-[var(--accent-blue)] text-[var(--bg)] px-4 py-2 rounded-md text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Create Subscriber
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
