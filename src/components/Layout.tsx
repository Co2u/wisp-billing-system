import { ReactNode, useState } from 'react';
import { Link, useLocation } from 'react-router';
import { LayoutDashboard, Users, FileText, LogOut, Activity, Server, Router, Settings as SettingsIcon, Menu, X } from 'lucide-react';

export default function Layout({ children, onLogout }: { children: ReactNode, onLogout: () => void }) {
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems = [
    { name: 'Dashboard', path: '/', icon: LayoutDashboard },
    { name: 'Subscribers', path: '/subscribers', icon: Users },
    { name: 'Invoices', path: '/invoices', icon: FileText },
    { name: 'Plans', path: '/plans', icon: Server },
    { name: 'Routers', path: '/routers', icon: Router },
    { name: 'Settings', path: '/settings', icon: SettingsIcon },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-[var(--bg)] text-[var(--text)]">
      <header className="px-4 md:px-8 py-4 md:py-6 border-b border-[var(--border)] flex justify-between items-center relative z-20 bg-[var(--bg)]">
        <div className="flex items-center gap-3">
          <button 
            className="md:hidden text-[var(--text)]"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
          <div className="bg-[var(--accent-blue)] w-8 h-8 rounded-md grid place-items-center font-bold text-[var(--bg)] shrink-0">
            W
          </div>
          <div className="hidden sm:block">
            <h1 className="text-xl font-semibold tracking-tight leading-tight">WISP Billing System</h1>
            <span className="text-xs text-[var(--text-dim)] uppercase tracking-wider hidden lg:block">MikroTik System Architect Console</span>
          </div>
        </div>
        
        <nav className={`absolute top-full left-0 right-0 bg-[var(--card-bg)] border-b border-[var(--border)] flex-col p-4 gap-4 md:static md:bg-transparent md:border-none md:flex-row md:flex md:items-center md:gap-6 md:p-0 ${mobileMenuOpen ? 'flex' : 'hidden'}`}>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setMobileMenuOpen(false)}
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

        <div className="flex items-center gap-4 md:gap-6">
          <div className="flex gap-2 md:gap-5 items-center">
            <div className="text-right hidden sm:block">
              <div className="text-[13px] font-semibold">Edge-Router-01</div>
              <div className="text-xs text-[var(--accent-green)] flex items-center justify-end gap-1">
                <Activity size={12} />
                <span className="hidden md:inline">CONNECTED • ROS v7.12.1</span>
                <span className="md:hidden">ON</span>
              </div>
            </div>
            <div className="w-2.5 h-2.5 rounded-full bg-[var(--accent-green)] shadow-[0_0_8px_var(--accent-green)]"></div>
          </div>
          <button 
            onClick={onLogout}
            className="text-[var(--text-dim)] hover:text-[var(--accent-red)] transition-colors p-2"
            title="Logout"
          >
            <LogOut size={18} />
          </button>
        </div>
      </header>

      <main className="flex-1 flex flex-col overflow-x-hidden relative z-10 w-full">
        {children}
      </main>
    </div>
  );
}
