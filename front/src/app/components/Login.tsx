import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router';
import { Fuel, Lock, AlertTriangle } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { login, isAuthed } from '../lib/auth';

export function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Куда вернуть после входа (если защита перебросила сюда с конкретной страницы).
  const from = (location.state as { from?: string } | null)?.from ?? '/';

  // Уже вошёл — незачем показывать форму.
  if (isAuthed()) {
    navigate(from, { replace: true });
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(username, password);
      navigate(from, { replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Неверный логин или пароль');
      setPassword('');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f0f2f5] px-4">
      <div className="w-full max-w-xs">
        {/* Логотип */}
        <div className="flex flex-col items-center mb-6">
          <div className="size-12 rounded-lg bg-blue-600 flex items-center justify-center mb-3">
            <Fuel className="size-6 text-white" />
          </div>
          <div className="text-slate-900" style={{ fontSize: '16px', fontWeight: 600 }}>GazOil</div>
          <div className="text-slate-500" style={{ fontSize: '12px' }}>Учёт смен</div>
        </div>

        <form onSubmit={handleSubmit} className="bg-white border border-[#d1d9e6] rounded-lg p-5 space-y-4">
          <div>
            <Label htmlFor="username" className="text-slate-600" style={{ fontSize: '12px' }}>Логин</Label>
            <Input
              id="username"
              autoFocus
              value={username}
              onChange={e => { setUsername(e.target.value); setError(''); }}
              className={`mt-1 h-9 border-[#d1d9e6] bg-[#f8fafc] ${error ? 'border-red-400' : ''}`}
              style={{ fontSize: '13px' }}
              placeholder="client1"
            />
          </div>

          <div>
            <Label htmlFor="password" className="text-slate-600" style={{ fontSize: '12px' }}>Пароль</Label>
            <div className="relative mt-1">
              <Lock className="size-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <Input
                id="password"
                type="password"
                value={password}
                onChange={e => { setPassword(e.target.value); setError(''); }}
                className={`h-9 pl-8 border-[#d1d9e6] bg-[#f8fafc] ${error ? 'border-red-400' : ''}`}
                style={{ fontSize: '13px' }}
                placeholder="Введите пароль"
              />
            </div>
            {error && (
              <p className="flex items-center gap-1 text-red-500 mt-1.5" style={{ fontSize: '11px' }}>
                <AlertTriangle className="size-3" />
                {error}
              </p>
            )}
          </div>

          <Button type="submit" disabled={loading} className="w-full bg-blue-600 hover:bg-blue-700 text-white h-9 disabled:opacity-60" style={{ fontSize: '13px', fontWeight: 500 }}>
            {loading ? 'Вход…' : 'Войти'}
          </Button>
        </form>
      </div>
    </div>
  );
}
