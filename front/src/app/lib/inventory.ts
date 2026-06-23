import { GasDelivery, Shift } from '../types';
import { round2 } from './calculations';

// Бегущий остаток газа в резервуаре. Хранилища остатка нет — он выводится из
// начального остатка, прихода (поставки) и реализации смен, разложенных по времени.
//
// Событие прихода увеличивает остаток в момент поставки; событие смены уменьшает
// его на реализацию в момент ОКОНЧАНИЯ смены (газ считаем проданным к концу смены).

export type InventoryEventKind = 'delivery' | 'shift';

export interface InventoryEvent {
  kind: InventoryEventKind;
  refId: string;        // id поставки или смены
  at: number;           // метка времени (ключ сортировки)
  date: string;         // ISO ГГГГ-ММ-ДД
  time: string;         // ЧЧ:ММ
  delta: number;        // +приход / −реализация
  balanceAfter: number; // остаток после события
  label: string;        // описание (поставщик / тип события)
  negative: boolean;    // остаток ушёл в минус (продали больше, чем было)
  overfill: boolean;    // приход превысил объём резервуара
}

export interface InventoryTimeline {
  events: InventoryEvent[];     // по возрастанию времени
  currentBalance: number;       // остаток после последнего события
  warnings: InventoryEvent[];   // события с negative || overfill
}

function ts(date: string, time: string): number {
  return new Date(`${date}T${time || '00:00'}`).getTime();
}

/** Полная лента движения остатка: приходы и реализации смен по времени. */
export function buildInventoryTimeline(
  initialStock: number,
  tankCapacity: number,
  deliveries: GasDelivery[],
  shifts: Shift[],
): InventoryTimeline {
  type Raw = Omit<InventoryEvent, 'balanceAfter' | 'negative' | 'overfill'>;
  const raw: Raw[] = [];

  for (const d of deliveries) {
    raw.push({
      kind: 'delivery', refId: d.id, at: ts(d.date, d.time),
      date: d.date, time: d.time, delta: d.liters,
      label: d.supplier ? `Приход — ${d.supplier}` : 'Приход газа',
    });
  }
  for (const s of shifts) {
    raw.push({
      kind: 'shift', refId: s.id, at: ts(s.endDate, s.endTime),
      date: s.endDate, time: s.endTime, delta: -s.totalLiters,
      label: 'Реализация смены',
    });
  }

  // По времени; при равном времени приход применяем раньше реализации (мягче к минусу).
  raw.sort((a, b) => a.at - b.at
    || (a.kind === 'delivery' ? 0 : 1) - (b.kind === 'delivery' ? 0 : 1));

  const events: InventoryEvent[] = [];
  let balance = round2(initialStock);
  for (const e of raw) {
    balance = round2(balance + e.delta);
    events.push({
      ...e,
      balanceAfter: balance,
      negative: balance < 0,
      overfill: tankCapacity > 0 && e.kind === 'delivery' && balance > tankCapacity,
    });
  }

  return {
    events,
    currentBalance: balance,
    warnings: events.filter(e => e.negative || e.overfill),
  };
}

/**
 * Остаток до и после конкретной смены — для контроля прямо в форме.
 * `shifts` — все прочие смены (без редактируемой). Приход и чужие смены,
 * случившиеся до конца этой смены, формируют остаток «до».
 */
export function balanceAroundShift(opts: {
  initialStock: number;
  deliveries: GasDelivery[];
  otherShifts: Shift[];
  shiftEnd: number;     // метка времени конца смены
  shiftLiters: number;  // реализация этой смены
}): { before: number; after: number } {
  const { initialStock, deliveries, otherShifts, shiftEnd, shiftLiters } = opts;
  let before = initialStock;
  for (const d of deliveries) {
    if (ts(d.date, d.time) <= shiftEnd) before += d.liters;
  }
  for (const s of otherShifts) {
    if (ts(s.endDate, s.endTime) <= shiftEnd) before -= s.totalLiters;
  }
  before = round2(before);
  return { before, after: round2(before - shiftLiters) };
}
