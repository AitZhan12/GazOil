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
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  // Куда вернуть после входа (если защита перебросила сюда с конкретной страницы).
  const from = (location.state as { from?: string } | null)?.from ?? '/';

  // Уже вошёл — незачем показывать форму.
  if (isAuthed()) {
    navigate(from, { replace: true });
    return null;
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (login(password)) {
      navigate(from, { replace: true });
    } else {
      setError('Неверный пароль');
      setPassword('');
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
            <Label htmlFor="password" className="text-slate-600" style={{ fontSize: '12px' }}>Пароль</Label>
            <div className="relative mt-1">
              <Lock className="size-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <Input
                id="password"
                type="password"
                autoFocus
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

          <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white h-9" style={{ fontSize: '13px', fontWeight: 500 }}>
            Войти
          </Button>
        </form>
      </div>
    </div>
  );
}
