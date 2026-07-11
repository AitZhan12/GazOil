const AUTH_KEY = 'azs.auth';
const USER_KEY = 'azs.user';
const STATION_KEY = 'azs.station';

const API_BASE: string =
  (import.meta as any).env?.VITE_API_URL ?? 'http://localhost:8080/api';

type AuthResponse = {
  token: string;
  username: string;
  stationName: string;
};

export function isAuthed(): boolean {
  try {
    const token = localStorage.getItem(AUTH_KEY);
    return Boolean(token && token !== '1');
  } catch {
    return false;
  }
}

export function getAuthToken(): string | null {
  try {
    const token = localStorage.getItem(AUTH_KEY);
    return token && token !== '1' ? token : null;
  } catch {
    return null;
  }
}

export function getCurrentUser(): { username: string | null; stationName: string | null } {
  try {
    return {
      username: localStorage.getItem(USER_KEY),
      stationName: localStorage.getItem(STATION_KEY),
    };
  } catch {
    return { username: null, stationName: null };
  }
}

export async function login(username: string, password: string): Promise<void> {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) {
    let message = 'Неверный логин или пароль';
    try {
      const body = await res.json();
      if (body?.error) message = body.error;
    } catch {
      /* ignore */
    }
    throw new Error(message);
  }
  const body = await res.json() as AuthResponse;
  try {
    localStorage.setItem(AUTH_KEY, body.token);
    localStorage.setItem(USER_KEY, body.username);
    localStorage.setItem(STATION_KEY, body.stationName);
  } catch {
    /* ignore */
  }
}

export function logout(): void {
  try {
    localStorage.removeItem(AUTH_KEY);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(STATION_KEY);
  } catch { /* ignore */ }
}
