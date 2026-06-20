import { Link, Outlet, useLocation, Navigate, useNavigate } from 'react-router';
import { FileText, BarChart3, Users, Settings as SettingsIcon, Fuel, LogOut } from 'lucide-react';
import { isAuthed, logout } from '../lib/auth';

export function Root() {
  const location = useLocation();
  const navigate = useNavigate();

  // Гейт: не вошёл — на страницу входа (с возвратом на запрошенный путь).
  if (!isAuthed()) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  const navLinks = [
    { path: '/', label: 'Журнал смен', icon: FileText },
    { path: '/report', label: 'Месячный отчёт', icon: BarChart3 },
    { path: '/operators', label: 'Операторы', icon: Users },
    { path: '/settings', label: 'Настройки', icon: SettingsIcon },
  ];

  return (
    <div className="min-h-screen flex bg-[#f0f2f5]">
      {/* Sidebar */}
      <aside className="w-56 shrink-0 bg-[#0f172a] flex flex-col">
        {/* Logo */}
        <div className="px-5 py-5 border-b border-[#1e293b]">
          <div className="flex items-center gap-2.5">
            <div className="size-7 rounded bg-blue-600 flex items-center justify-center shrink-0">
              <Fuel className="size-4 text-white" />
            </div>
            <div>
              <div className="text-white leading-tight" style={{ fontSize: '13px', fontWeight: 600 }}>
                GazOil
              </div>
              <div className="text-slate-500 leading-tight" style={{ fontSize: '11px' }}>
                Учёт смен
              </div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {navLinks.map((link) => {
            const Icon = link.icon;
            const active = isActive(link.path);
            return (
              <Link
                key={link.path}
                to={link.path}
                className={`
                  flex items-center gap-2.5 px-3 py-2 rounded transition-colors
                  ${active
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-400 hover:bg-[#1e293b] hover:text-slate-100'
                  }
                `}
                style={{ fontSize: '13px', fontWeight: active ? 500 : 400 }}
              >
                <Icon className="size-4 shrink-0" />
                {link.label}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="px-3 py-4 border-t border-[#1e293b] space-y-3">
          <button
            type="button"
            onClick={handleLogout}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded text-slate-400 hover:bg-[#1e293b] hover:text-slate-100 transition-colors"
            style={{ fontSize: '13px' }}
          >
            <LogOut className="size-4 shrink-0" />
            Выйти
          </button>
          <div className="px-3 text-slate-600" style={{ fontSize: '11px' }}>
            3 колонки · 5 операторов
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        <main className="flex-1 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
