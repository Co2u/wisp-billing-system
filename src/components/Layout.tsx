import { ReactNode } from 'react';
import { Link, useLocation } from 'react-router';
import { LayoutDashboard, Users, FileText, LogOut, Activity, Server, Router } from 'lucide-react';

export default function Layout({ children, onLogout }: { children: ReactNode, onLogout: () => void }) {
  const location = useLocation();

  const navItems = [
    { name: 'Dashboard', path: '/', icon: LayoutDashboard },
    { name: 'Subscribers', path: '/subscribers', icon: Users },
    { name: 'Invoices', path: '/invoices', icon: FileText },
    { name: 'Plans', path: '/plans', icon: Server },
    { name: 'Routers', path: '/routers', icon: Router },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-[var(--bg)] text-[var(--text)]">
      <header className="px-8 py-6 border-b border-[var(--border)] flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="bg-[var(--accent-blue)] w-8 h-8 rounded-md grid place-items-center font-bold text-[var(--bg)]">
            W
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight leading-tight">WISP-BMS</h1>
            <span className="text-xs text-[var(--text-dim)] uppercase tracking-wider">MikroTik System Architect Console</span>
          </div>
        </div>
        
        <nav className="flex items-center gap-6">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-2 text-sm font-medium transition-colors ${
                  isActive ? 'text-[var(--accent-blue)]' : 'text-[var(--text-dim)] hover:text-[var(--text)]'
                }`}
              >
                <Icon size={16} />
                {item.name}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-6">
          <div className="flex gap-5">
            <div className="text-right">
              <div className="text-[13px] font-semibold">Edge-Router-01</div>
              <div className="text-xs text-[var(--accent-green)] flex items-center justify-end gap-1">
                <Activity size={12} />
                CONNECTED • ROS v7.12.1
              </div>
            </div>
            <div className="w-2.5 h-2.5 rounded-full bg-[var(--accent-green)] shadow-[0_0_8px_var(--accent-green)] mt-1.5"></div>
          </div>
          <button 
            onClick={onLogout}
            className="text-[var(--text-dim)] hover:text-[var(--accent-red)] transition-colors"
            title="Logout"
          >
            <LogOut size={18} />
          </button>
        </div>
      </header>

      <main className="flex-1 flex flex-col overflow-hidden">
        {children}
      </main>
    </div>
  );
}
