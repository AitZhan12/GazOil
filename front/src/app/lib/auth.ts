// Простой клиентский пароль-гейт (без бэка). Защита условная: API остаётся
// открытым, это лишь «чтобы не зашёл случайный» с UI-стороны.

const AUTH_KEY = 'azs.auth';

// Пароль берём из .env (VITE_APP_PASSWORD), иначе дефолт. Менять без правки кода.
const PASSWORD: string =
  (import.meta as any).env?.VITE_APP_PASSWORD ?? 'azs2026';

export function isAuthed(): boolean {
  try {
    return localStorage.getItem(AUTH_KEY) === '1';
  } catch {
    return false;
  }
}

export function login(password: string): boolean {
  if (password === PASSWORD) {
    try { localStorage.setItem(AUTH_KEY, '1'); } catch { /* ignore */ }
    return true;
  }
  return false;
}

export function logout(): void {
  try { localStorage.removeItem(AUTH_KEY); } catch { /* ignore */ }
}
