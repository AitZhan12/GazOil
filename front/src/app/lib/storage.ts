import { AppSettings, FuelPrice, GasDelivery, Operator, Shift, TankReset, WaterRecord } from '../types';
import { getAuthToken, logout } from './auth';

// База API бэка (Spring Boot). Можно переопределить через VITE_API_URL.
const API_BASE: string =
  (import.meta as any).env?.VITE_API_URL ?? 'http://localhost:8080/api';

async function http<T>(path: string, options?: RequestInit): Promise<T> {
  const token = getAuthToken();
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'X-Auth-Token': token } : {}),
      ...(options?.headers ?? {}),
    },
  });
  if (!res.ok) {
    if (res.status === 401) logout();
    let message = `Ошибка запроса (${res.status})`;
    try {
      const body = await res.json();
      if (body?.error) message = body.error;
    } catch {
      /* тело не JSON — оставляем дефолтное сообщение */
    }
    throw new Error(message);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

// ---- Операторы ----

export function getOperators(): Promise<Operator[]> {
  return http<Operator[]>('/operators');
}

export function createOperator(input: { name: string }): Promise<Operator> {
  return http<Operator>('/operators', {
    method: 'POST',
    body: JSON.stringify({ name: input.name }),
  });
}

export function updateOperator(id: string, operator: Operator): Promise<Operator> {
  return http<Operator>(`/operators/${id}`, {
    method: 'PUT',
    body: JSON.stringify({
      name: operator.name,
      active: operator.active,
    }),
  });
}

// ---- Смены ----

export function getShifts(): Promise<Shift[]> {
  return http<Shift[]>('/shifts');
}

export function getShiftById(id: string): Promise<Shift | undefined> {
  return http<Shift>(`/shifts/${id}`).catch(() => undefined);
}

export function addShift(shift: Shift): Promise<Shift> {
  return http<Shift>('/shifts', {
    method: 'POST',
    body: JSON.stringify(shift),
  });
}

export function updateShift(id: string, shift: Shift): Promise<Shift> {
  return http<Shift>(`/shifts/${id}`, {
    method: 'PUT',
    body: JSON.stringify(shift),
  });
}

export function deleteShift(id: string): Promise<void> {
  return http<void>(`/shifts/${id}`, { method: 'DELETE' });
}

export function setShiftCashCollected(id: string, cashCollected: boolean): Promise<Shift> {
  return http<Shift>(`/shifts/${id}/cash-collected`, {
    method: 'PATCH',
    body: JSON.stringify({ cashCollected }),
  });
}

// ---- Журнал воды ----

export function getWaterRecords(): Promise<WaterRecord[]> { return http<WaterRecord[]>('/water-records'); }

export function addWaterRecord(record: Omit<WaterRecord, 'id' | 'balanceQuantity'>): Promise<WaterRecord> {
  return http<WaterRecord>('/water-records', { method: 'POST', body: JSON.stringify(record) });
}

export function updateWaterRecord(id: string, record: Omit<WaterRecord, 'id' | 'balanceQuantity'>): Promise<WaterRecord> {
  return http<WaterRecord>(`/water-records/${id}`, { method: 'PUT', body: JSON.stringify(record) });
}

export function deleteWaterRecord(id: string): Promise<void> { return http<void>(`/water-records/${id}`, { method: 'DELETE' }); }

// ---- Настройки (ставки ЗП, цены по умолчанию, ступени бонуса) ----

export function getSettings(): Promise<AppSettings> {
  return http<AppSettings>('/settings');
}

export function updateSettings(settings: AppSettings): Promise<AppSettings> {
  return http<AppSettings>('/settings', {
    method: 'PUT',
    body: JSON.stringify(settings),
  });
}

// ---- Приход газа (поставки) ----

export function getDeliveries(): Promise<GasDelivery[]> {
  return http<GasDelivery[]>('/deliveries');
}

export function addDelivery(delivery: Omit<GasDelivery, 'id'>): Promise<GasDelivery> {
  return http<GasDelivery>('/deliveries', {
    method: 'POST',
    body: JSON.stringify(delivery),
  });
}

export function updateDelivery(id: string, delivery: GasDelivery): Promise<GasDelivery> {
  return http<GasDelivery>(`/deliveries/${id}`, {
    method: 'PUT',
    body: JSON.stringify(delivery),
  });
}

export function deleteDelivery(id: string): Promise<void> {
  return http<void>(`/deliveries/${id}`, { method: 'DELETE' });
}

// ---- Обнуления резервуара ----

export function getTankResets(): Promise<TankReset[]> {
  return http<TankReset[]>('/tank-resets');
}

export function addTankReset(reset: Omit<TankReset, 'id'>): Promise<TankReset> {
  return http<TankReset>('/tank-resets', {
    method: 'POST',
    body: JSON.stringify(reset),
  });
}

export function updateTankReset(id: string, reset: TankReset): Promise<TankReset> {
  return http<TankReset>(`/tank-resets/${id}`, {
    method: 'PUT',
    body: JSON.stringify(reset),
  });
}

export function deleteTankReset(id: string): Promise<void> {
  return http<void>(`/tank-resets/${id}`, { method: 'DELETE' });
}

// ---- Цены 107/112 (снапшотятся в смену при создании) ----

export function getFuelPrice(): Promise<FuelPrice> {
  return http<FuelPrice>('/config/fuel-price');
}

export function updateFuelPrice(price: FuelPrice): Promise<FuelPrice> {
  return http<FuelPrice>('/config/fuel-price', {
    method: 'PUT',
    body: JSON.stringify(price),
  });
}
