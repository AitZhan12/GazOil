import { useEffect, useState } from 'react';
import { Link, Outlet, useLocation, Navigate, useNavigate } from 'react-router';
import { FileText, BarChart3, Users, Settings as SettingsIcon, Fuel, LogOut, Menu, X } from 'lucide-react';
import { isAuthed, logout } from '../lib/auth';

export function Root() {
  const location = useLocation();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  // Закрываем мобильное меню при смене маршрута.
  useEffect(() => { setMenuOpen(false); }, [location.pathname]);

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
      {/* Затемнение под выехавшим меню (только на мобильных) */}
      {menuOpen && (
        <button
          type="button"
          aria-label="Закрыть меню"
          onClick={() => setMenuOpen(false)}
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-40 w-56 shrink-0 bg-[#0f172a] flex flex-col
          transition-transform duration-200 ease-out
          lg:static lg:translate-x-0
          ${menuOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        {/* Logo */}
        <div className="px-5 py-5 border-b border-[#1e293b] flex items-center justify-between">
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
          {/* Кнопка закрытия — только на мобильных */}
          <button
            type="button"
            onClick={() => setMenuOpen(false)}
            aria-label="Закрыть меню"
            className="lg:hidden text-slate-400 hover:text-slate-100 transition-colors"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
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
        {/* Верхняя панель с гамбургером — только на мобильных */}
        <header className="lg:hidden sticky top-0 z-20 flex items-center gap-3 px-4 h-12 bg-[#0f172a] border-b border-[#1e293b]">
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            aria-label="Открыть меню"
            className="text-slate-300 hover:text-white transition-colors"
          >
            <Menu className="size-5" />
          </button>
          <div className="flex items-center gap-2">
            <div className="size-6 rounded bg-blue-600 flex items-center justify-center shrink-0">
              <Fuel className="size-3.5 text-white" />
            </div>
            <span className="text-white" style={{ fontSize: '13px', fontWeight: 600 }}>GazOil</span>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
