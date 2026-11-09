const AUTH_KEY = 'azs.auth';
const USER_KEY = 'azs.user';
const STATION_KEY = 'azs.station';
const STATION_ID_KEY = 'azs.station.id';
const STATIONS_KEY = 'azs.stations';

const API_BASE: string =
  (import.meta as any).env?.VITE_API_URL ?? 'http://localhost:8080/api';

type AuthResponse = {
  token: string;
  username: string;
  stationId: number;
  stationName: string;
  pumpCount: number;
  stations: { id: number; name: string; pumpCount: number }[];
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

export function getCurrentUser(): { username: string | null; stationId: string | null; stationName: string | null; pumpCount: number } {
  try {
    return {
      username: localStorage.getItem(USER_KEY),
      stationId: localStorage.getItem(STATION_ID_KEY),
      stationName: localStorage.getItem(STATION_KEY),
      pumpCount: Number(localStorage.getItem('azs.station.pumpCount')) || 3,
    };
  } catch {
    return { username: null, stationId: null, stationName: null, pumpCount: 3 };
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
    localStorage.setItem(STATION_ID_KEY, String(body.stationId));
    localStorage.setItem(STATION_KEY, body.stationName);
    localStorage.setItem('azs.station.pumpCount', String(body.pumpCount));
    localStorage.setItem(STATIONS_KEY, JSON.stringify(body.stations ?? []));
  } catch {
    /* ignore */
  }
}

export function logout(): void {
  try {
    localStorage.removeItem(AUTH_KEY);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(STATION_KEY);
    localStorage.removeItem(STATION_ID_KEY);
    localStorage.removeItem('azs.station.pumpCount');
    localStorage.removeItem(STATIONS_KEY);
  } catch { /* ignore */ }
}

export function getAvailableStations(): { id: string; name: string; pumpCount: number }[] {
  try {
    const stations = JSON.parse(localStorage.getItem(STATIONS_KEY) ?? '[]') as { id: string | number; name: string; pumpCount: number }[];
    return stations.map(station => ({ ...station, id: String(station.id) }));
  } catch {
    return [];
  }
}

export async function fetchAvailableStations(): Promise<{ id: string; name: string; pumpCount: number }[]> {
  const token = getAuthToken();
  const res = await fetch(`${API_BASE}/auth/stations`, {
    headers: {
      ...(token ? { 'X-Auth-Token': token } : {}),
      ...(getCurrentUser().stationId ? { 'X-Station-Id': getCurrentUser().stationId! } : {}),
    },
  });
  if (!res.ok) throw new Error('Не удалось загрузить список заправок');
  const stations = (await res.json()) as { id: string | number; name: string; pumpCount: number }[];
  const normalized = stations.map(station => ({ ...station, id: String(station.id) }));
  localStorage.setItem(STATIONS_KEY, JSON.stringify(normalized));
  return normalized;
}

export function selectStation(station: { id: string; name: string; pumpCount: number }): void {
  localStorage.setItem(STATION_ID_KEY, String(station.id));
  localStorage.setItem(STATION_KEY, station.name);
  localStorage.setItem('azs.station.pumpCount', String(station.pumpCount));
}
