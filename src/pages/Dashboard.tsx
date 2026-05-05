import { useState, useEffect } from 'react';
import { Activity, Users, Currency, AlertTriangle } from 'lucide-react';
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
    }, 5000); // reduced frequency to 5s

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="p-4 md:p-6 lg:p-8 flex-1 overflow-y-auto">
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        
        {/* Top Metric Cards */}
        <div className="bento-card">
          <div className="card-title">
            <Users size={16} />
            Total Subscribers
          </div>
          <div className="big-stat">{stats?.totalSubscribers || 0}</div>
          <div className="stat-sub">Active: {stats?.activeUsers || 0}</div>
        </div>

        <div className="bento-card">
          <div className="card-title">
            <Currency size={16} />
            Revenue (MRR)
          </div>
          <div className="big-stat">₱{stats?.monthlyRevenue?.toLocaleString() || 0}</div>
          <div className="stat-sub">This month</div>
        </div>

        <div className="bento-card">
          <div className="card-title">
            <AlertTriangle size={16} />
            Suspended Users
          </div>
          <div className="big-stat text-[var(--accent-orange)]">{stats?.suspendedUsers || 0}</div>
          <div className="stat-sub">Redirecting to Port 8082</div>
        </div>

        <div className="bento-card">
          <div className="card-title">
            <Activity size={16} />
            Network Load
          </div>
          <div className="big-stat">{stats?.systemHealth?.networkLoad || '0 Mbps'}</div>
          <div className="flex items-end gap-1.5 h-10 mt-auto opacity-80">
            {stats?.systemHealth?.loadHistory?.map((h: number, i: number) => (
              <div key={i} className="flex-1 bg-[var(--accent-blue)] rounded-t-sm transition-all duration-500" style={{ height: `${Math.max(10, h)}%` }}></div>
            )) || (
              <>
                <div className="flex-1 bg-[var(--accent-blue)] rounded-t-sm h-[30%]"></div>
                <div className="flex-1 bg-[var(--accent-blue)] rounded-t-sm h-[60%]"></div>
                <div className="flex-1 bg-[var(--accent-blue)] rounded-t-sm h-[40%]"></div>
                <div className="flex-1 bg-[var(--accent-blue)] rounded-t-sm h-[80%]"></div>
                <div className="flex-1 bg-[var(--accent-blue)] rounded-t-sm h-[50%]"></div>
                <div className="flex-1 bg-[var(--accent-blue)] rounded-t-sm h-[70%]"></div>
                <div className="flex-1 bg-[var(--accent-blue)] rounded-t-sm h-[100%]"></div>
              </>
            )}
          </div>
        </div>

        {/* Row 2: Enforcements & Logs */}
        <div className="bento-card lg:col-span-2 lg:row-span-2 min-h-[300px]">
          <div className="card-title">Active Enforcement Actions (IP-Based)</div>
          <div className="flex flex-col gap-2 flex-1 overflow-y-auto pr-2">
            {subscribers.length > 0 ? subscribers.map(sub => (
              <div key={sub.id} className="grid grid-cols-[1fr_auto_auto] gap-4 p-3 bg-[var(--bg)] border border-[var(--border)] rounded-lg text-sm items-center hover:border-[var(--accent-blue)] transition-colors">
                <div className="font-medium truncate">{sub.full_name}</div>
                <div className="font-mono text-[var(--text-dim)]">{sub.remote_address}</div>
                <div className={`badge ${sub.status === 'ACTIVE' ? 'badge-active' : 'badge-expired'}`}>
                  {sub.status}
                </div>
              </div>
            )) : (
              <div className="flex-1 grid place-items-center text-sm text-[var(--text-dim)] border border-dashed border-[var(--border)] rounded-lg">
                No active enforcement actions.
              </div>
            )}
            <div className="text-center text-[var(--text-dim)] text-xs mt-4">
              Showing {subscribers.length} of {stats?.totalSubscribers || 0} subscribers
            </div>
          </div>
        </div>

        <div className="bento-card lg:col-span-2 min-h-[200px]">
          <div className="card-title">System Logs</div>
          <div className="console overflow-y-auto">
            {logs.length > 0 ? logs.map(log => (
              <div key={log.id} className="mb-1">
                <span>[{new Date(log.created_at).toLocaleTimeString()}]</span> {log.action}: {log.details}
              </div>
            )) : (
              <div className="opacity-50 italic">No recent logs available.</div>
            )}
          </div>
        </div>

        {/* Row 3: Health & Actions */}
        <div className="bento-card">
          <div className="card-title">System Health</div>
          <div className="flex-1 flex flex-col justify-center gap-6">
            <div>
              <div className="flex justify-between text-xs mb-2">
                <span className="font-medium">Database Sync</span>
                <span className="text-[var(--text-dim)]">{stats?.systemHealth?.dbSync || 0}%</span>
              </div>
              <div className="h-1.5 bg-[var(--bg)] rounded-full overflow-hidden">
                <div 
                  className="h-full bg-[var(--accent-green)] rounded-full transition-all duration-500"
                  style={{ width: `${stats?.systemHealth?.dbSync || 0}%` }}
                ></div>
              </div>
            </div>
            <div>
              <div className="flex justify-between text-xs mb-2">
                <span className="font-medium">Worker Engine</span>
                <span className="text-[var(--text-dim)]">{stats?.systemHealth?.workerEngine || 0}%</span>
              </div>
              <div className="h-1.5 bg-[var(--bg)] rounded-full overflow-hidden">
                <div 
                  className="h-full bg-[var(--accent-green)] rounded-full transition-all duration-500"
                  style={{ width: `${stats?.systemHealth?.workerEngine || 0}%` }}
                ></div>
              </div>
            </div>
            <div>
              <div className="text-xs font-medium mb-1">Avg Router API Latency</div>
              <div className="text-2xl font-bold flex items-baseline gap-1">
                {stats?.systemHealth?.routerLatency || 0} <span className="text-sm font-normal text-[var(--text-dim)]">ms</span>
              </div>
            </div>
          </div>
        </div>

        <div className="bento-card">
          <div className="card-title">Quick Actions</div>
          <div className="flex flex-col gap-3 flex-1 justify-center">
            <Link to="/subscribers" className="flex items-center justify-center p-3 border border-[var(--accent-blue)] text-[var(--accent-blue)] rounded-lg text-sm font-medium hover:bg-[rgba(88,166,255,0.1)] transition-all">
              + New Subscriber
            </Link>
            <Link to="/routers" className="flex items-center justify-center p-3 bg-[var(--accent-blue)] text-[var(--bg)] rounded-lg text-sm font-semibold hover:bg-[#79b8ff] transition-all shadow-[0_0_15px_rgba(88,166,255,0.2)]">
              Sync address-list
            </Link>
            <div className="grid grid-cols-2 gap-3">
              <Link to="/invoices" className="flex items-center justify-center p-2.5 border border-[var(--border)] rounded-lg text-xs font-medium hover:bg-[var(--border)] hover:text-white transition-all">
                Invoices
              </Link>
              <Link to="/plans" className="flex items-center justify-center p-2.5 border border-[var(--border)] rounded-lg text-xs font-medium hover:bg-[var(--border)] hover:text-white transition-all">
                Plans
              </Link>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

