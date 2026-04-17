import { useState, useEffect } from 'react';
import { Activity, Users, DollarSign, AlertTriangle } from 'lucide-react';
import { Link } from 'react-router';
import { apiFetch } from '../lib/api';

export default function Dashboard() {
  const [stats, setStats] = useState<any>(null);
  const [subscribers, setSubscribers] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const headers = { Authorization: `Bearer ${localStorage.getItem('token')}` };
        
        const [statsRes, subsRes, logsRes] = await Promise.all([
          apiFetch('/api/dashboard', { headers }),
          apiFetch('/api/subscribers', { headers }),
          apiFetch('/api/logs', { headers })
        ]);

        if (statsRes.ok) setStats(await statsRes.json());
        if (subsRes.ok) {
          const allSubs = await subsRes.json();
          // Get a mix of active and expired for the dashboard view
          setSubscribers(allSubs.slice(0, 5));
        }
        if (logsRes.ok) setLogs(await logsRes.json());
      } catch (err) {
        console.error('Failed to fetch dashboard data', err);
      }
    };
    
    fetchData();
    const interval = setInterval(() => {
      const headers = { Authorization: `Bearer ${localStorage.getItem('token')}` };
      apiFetch('/api/dashboard', { headers })
        .then(res => {
          if (!res.ok) throw new Error('Failed to fetch stats');
          return res.json();
        })
        .then(data => setStats(data))
        .catch(err => console.error(err));
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="dashboard-grid">
      {/* Key Metrics */}
      <div className="bento-card">
        <div className="card-title">
          <Users size={14} />
          Total Subscribers
        </div>
        <div className="big-stat">{stats?.totalSubscribers || 0}</div>
        <div className="stat-sub">Active: {stats?.activeUsers || 0}</div>
      </div>

      <div className="bento-card">
        <div className="card-title">
          <DollarSign size={14} />
          Revenue (MRR)
        </div>
        <div className="big-stat">${stats?.monthlyRevenue?.toLocaleString() || 0}</div>
        <div className="stat-sub">This month</div>
      </div>

      {/* Subscriber Enforcement List */}
      <div className="bento-card span-2-2">
        <div className="card-title">Active Enforcement Actions (IP-Based)</div>
        <div className="flex flex-col gap-2 overflow-hidden">
          {subscribers.length > 0 ? subscribers.map(sub => (
            <div key={sub.id} className="grid grid-cols-[1fr_1fr_80px] px-3 py-2.5 bg-white/5 rounded-md text-[13px] items-center">
              <span className="font-semibold">{sub.full_name}</span>
              <span className="font-mono opacity-80">{sub.remote_address}</span>
              <span className={`badge ${sub.status === 'ACTIVE' ? 'badge-active' : 'badge-expired'}`}>
                {sub.status}
              </span>
            </div>
          )) : (
            <div className="p-4 text-center text-[var(--text-dim)]">No subscribers found.</div>
          )}
          <div className="p-2.5 text-center text-[var(--text-dim)] text-xs mt-auto">
            Showing {subscribers.length} of {stats?.totalSubscribers || 0} subscribers
          </div>
        </div>
      </div>

      <div className="bento-card">
        <div className="card-title">
          <AlertTriangle size={14} />
          Suspended Users
        </div>
        <div className="big-stat text-[var(--accent-orange)]">{stats?.suspendedUsers || 0}</div>
        <div className="stat-sub">Redirecting to Port 8082</div>
      </div>

      <div className="bento-card">
        <div className="card-title">
          <Activity size={14} />
          Network Load
        </div>
        <div className="big-stat">{stats?.systemHealth?.networkLoad || '0 Mbps'}</div>
        <div className="flex items-end gap-1 h-10 mt-auto">
          {stats?.systemHealth?.loadHistory?.map((h: number, i: number) => (
            <div key={i} className="w-2 bg-[var(--accent-blue)] rounded-t-sm opacity-100 transition-all duration-500" style={{ height: `${Math.max(10, h)}%` }}></div>
          )) || (
            <>
              <div className="w-2 bg-[var(--accent-blue)] rounded-t-sm opacity-100 h-2.5"></div>
              <div className="w-2 bg-[var(--accent-blue)] rounded-t-sm opacity-100 h-6"></div>
              <div className="w-2 bg-[var(--accent-blue)] rounded-t-sm opacity-100 h-4"></div>
              <div className="w-2 bg-[var(--accent-blue)] rounded-t-sm opacity-100 h-9"></div>
              <div className="w-2 bg-[var(--accent-blue)] rounded-t-sm opacity-100 h-7"></div>
              <div className="w-2 bg-[var(--accent-blue)] rounded-t-sm opacity-100 h-3"></div>
              <div className="w-2 bg-[var(--accent-blue)] rounded-t-sm opacity-100 h-10"></div>
            </>
          )}
        </div>
      </div>

      {/* API / Console Log */}
      <div className="bento-card span-2-1">
        <div className="card-title">System Logs</div>
        <div className="console">
          {logs.length > 0 ? logs.map(log => (
            <div key={log.id}>
              <span>[{new Date(log.created_at).toLocaleTimeString()}]</span> {log.action}: {log.details}
            </div>
          )) : (
            <div>No recent logs.</div>
          )}
        </div>
      </div>

      <div className="bento-card span-1-2">
        <div className="card-title">System Health</div>
        <div className="flex-1 flex flex-col justify-around">
          <div>
            <div className="text-xs mb-1">Database Sync</div>
            <div className="h-1 bg-[var(--border)] rounded-full">
              <div 
                className="h-full bg-[var(--accent-green)] rounded-full transition-all duration-500"
                style={{ width: `${stats?.systemHealth?.dbSync || 0}%` }}
              ></div>
            </div>
          </div>
          <div>
            <div className="text-xs mb-1">Worker Engine</div>
            <div className="h-1 bg-[var(--border)] rounded-full">
              <div 
                className="h-full bg-[var(--accent-green)] rounded-full transition-all duration-500"
                style={{ width: `${stats?.systemHealth?.workerEngine || 0}%` }}
              ></div>
            </div>
          </div>
          <div>
            <div className="text-xs mb-1">Avg Router API Latency</div>
            <div className="text-xl font-bold">{stats?.systemHealth?.routerLatency || 0}ms</div>
          </div>
        </div>
      </div>

      <div className="bento-card span-1-2">
        <div className="card-title">Quick Actions</div>
        <div className="grid gap-2 flex-1 content-start">
          <Link to="/subscribers" className="p-2 border border-[var(--accent-blue)] text-[var(--accent-blue)] rounded-md text-xs text-center cursor-pointer hover:bg-[rgba(88,166,255,0.1)] transition-colors">
            + New Subscriber
          </Link>
          <Link to="/routers" className="p-2 bg-[var(--accent-blue)] text-[var(--bg)] rounded-md text-xs text-center font-semibold cursor-pointer hover:opacity-90 transition-opacity">
            Sync address-list
          </Link>
          <Link to="/invoices" className="p-2 border border-[var(--border)] rounded-md text-xs text-center cursor-pointer hover:bg-[var(--border)] transition-colors">
            Manage Invoices
          </Link>
          <Link to="/plans" className="p-2 border border-[var(--border)] rounded-md text-xs text-center cursor-pointer hover:bg-[var(--border)] transition-colors">
            View Service Plans
          </Link>
        </div>
      </div>
    </div>
  );
}
