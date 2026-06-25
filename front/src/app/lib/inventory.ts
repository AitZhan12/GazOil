import { GasDelivery, Shift, TankReset } from '../types';
import { round2 } from './calculations';

// Бегущий остаток газа в резервуаре. Хранилища остатка нет — он выводится из
// начального остатка, прихода (поставки), реализации смен и обнулений, разложенных
// по времени.
//
// Событие прихода увеличивает остаток в момент поставки; событие смены уменьшает
// его на реализацию в момент ОКОНЧАНИЯ смены (газ считаем проданным к концу смены);
// обнуление принудительно сбрасывает остаток в ноль (газ закончился) — накопленная
// погрешность замеров списывается, и остаток дальше растёт заново от нуля.

export type InventoryEventKind = 'delivery' | 'shift' | 'reset';

export interface InventoryEvent {
  kind: InventoryEventKind;
  refId: string;        // id поставки, смены или обнуления
  at: number;           // метка времени (ключ сортировки)
  date: string;         // ISO ГГГГ-ММ-ДД
  time: string;         // ЧЧ:ММ
  delta: number;        // +приход / −реализация / списание при обнулении
  balanceAfter: number; // остаток после события
  label: string;        // описание (поставщик / тип события)
  negative: boolean;    // остаток ушёл в минус сверх погрешности
  overfill: boolean;    // приход превысил объём резервуара сверх погрешности
}

export interface InventoryTimeline {
  events: InventoryEvent[];     // по возрастанию времени
  currentBalance: number;       // остаток после последнего события
  warnings: InventoryEvent[];   // события с negative || overfill
}

function ts(date: string, time: string): number {
  return new Date(`${date}T${time || '00:00'}`).getTime();
}

// Порядок применения событий с одинаковой меткой времени: приход → смена → обнуление.
// Обнуление идёт последним, чтобы списать всё, что случилось в этот же момент.
const KIND_ORDER: Record<InventoryEventKind, number> = { delivery: 0, shift: 1, reset: 2 };

/** Полная лента движения остатка: приходы, реализации смен и обнуления по времени. */
export function buildInventoryTimeline(
  initialStock: number,
  tankCapacity: number,
  deliveries: GasDelivery[],
  shifts: Shift[],
  resets: TankReset[] = [],
  tolerance = 0,
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
  for (const r of resets) {
    raw.push({
      kind: 'reset', refId: r.id, at: ts(r.date, r.time),
      date: r.date, time: r.time, delta: 0, // фактическое списание проставим ниже
      label: r.note ? `Обнуление — ${r.note}` : 'Обнуление резервуара',
    });
  }

  raw.sort((a, b) => a.at - b.at || KIND_ORDER[a.kind] - KIND_ORDER[b.kind]);

  const events: InventoryEvent[] = [];
  let balance = round2(initialStock);
  for (const e of raw) {
    if (e.kind === 'reset') {
      const delta = round2(-balance); // сколько списали при обнулении
      balance = 0;
      events.push({ ...e, delta, balanceAfter: 0, negative: false, overfill: false });
      continue;
    }
    balance = round2(balance + e.delta);
    events.push({
      ...e,
      balanceAfter: balance,
      negative: balance < -tolerance,
      overfill: tankCapacity > 0 && e.kind === 'delivery' && balance > tankCapacity + tolerance,
    });
  }

  return {
    events,
    currentBalance: balance,
    warnings: events.filter(e => e.negative || e.overfill),
  };
}

/** Сверка обнуления: физически прошло через колонки vs записано продано по сменам. */
export interface ResetReconciliation {
  physicalDispensed: number; // Σ (показание − база) по колонкам — прошло через счётчики
  recordedSold: number;      // Σ литров смен за интервал
  diff: number;              // physicalDispensed − recordedSold (минус = продали меньше, чем прошло)
  withinTolerance: boolean;  // |diff| ≤ погрешности
}

// Σ показаний колонок одной смены (старт/конец) — суммируем по номерам колонок.
function shiftStartSum(s: Shift, count: number): number {
  let sum = 0;
  for (let p = 1; p <= count; p++) sum += s.pumps.find(x => x.pumpNumber === p)?.start ?? 0;
  return sum;
}
function shiftEndSum(s: Shift, count: number): number {
  let sum = 0;
  for (let p = 1; p <= count; p++) sum += s.pumps.find(x => x.pumpNumber === p)?.end ?? 0;
  return sum;
}

// База сверки для обнуления: Σ показаний предыдущего обнуления, а для первого —
// Σ стартовых показаний самой ранней смены. null, если базы нет.
function reconBaseline(
  prev: TankReset | undefined,
  firstShift: Shift | undefined,
  count: number,
): { sum: number; label: string } | null {
  if (prev && (prev.pumpReadings?.length ?? 0) > 0) {
    let sum = 0;
    for (let p = 1; p <= count; p++) sum += prev.pumpReadings[p - 1] ?? 0;
    return { sum, label: `Прошлое обнуление — ${prev.date} ${prev.time}` };
  }
  if (!prev && firstShift) {
    let sum = 0;
    for (let p = 1; p <= count; p++) sum += firstShift.pumps.find(x => x.pumpNumber === p)?.start ?? 0;
    return { sum, label: `Старт первой смены — ${firstShift.startDate} ${firstShift.startTime}` };
  }
  return null;
}

/**
 * Сверяет каждое обнуление по ПОКАЗАНИЯМ счётчиков (не по времени), чтобы корректно
 * учитывать обнуление в любой момент, в т.ч. посреди смены. Физически прошло через
 * колонки = Σ показаний обнуления − база. Записано = сумма «срезов» смен, попавших в
 * диапазон показаний [база; обнуление] (смена на стыке учитывается ровно той частью,
 * что прошла до обнуления). Расхождение = непокрытые сменами литры (пропуски/недозапись).
 * База — предыдущее обнуление, для первого — стартовые показания самой ранней смены.
 */
export function reconcileResets(
  resets: TankReset[],
  shifts: Shift[],
  tolerance = 0,
): Map<string, ResetReconciliation> {
  const result = new Map<string, ResetReconciliation>();
  const sorted = [...resets].sort((a, b) => ts(a.date, a.time) - ts(b.date, b.time));
  const firstShift = [...shifts].sort(
    (a, b) => ts(a.startDate, a.startTime) - ts(b.startDate, b.startTime))[0];

  sorted.forEach((reset, i) => {
    const readings = reset.pumpReadings ?? [];
    if (readings.length === 0) return; // нечего сверять
    const count = readings.length;

    const base = reconBaseline(sorted[i - 1], firstShift, count);
    if (!base) return;
    const bSum = base.sum;
    const rSum = readings.reduce((s, v) => s + (v ?? 0), 0);

    const physical = round2(rSum - bSum);
    // Записано = Σ срезов смен, попавших в диапазон показаний [bSum; rSum].
    let recorded = 0;
    for (const s of shifts) {
      const lo = Math.max(shiftStartSum(s, count), bSum);
      const hi = Math.min(shiftEndSum(s, count), rSum);
      if (hi > lo) recorded += hi - lo;
    }
    recorded = round2(recorded);

    const diff = round2(physical - recorded);
    result.set(reset.id, {
      physicalDispensed: physical,
      recordedSold: recorded,
      diff,
      withinTolerance: Math.abs(diff) <= tolerance,
    });
  });

  return result;
}

/** Звено разбора сверки: смена или «хвост» после последней смены до обнуления. */
export interface ResetDetailRow {
  kind: 'shift' | 'tail';
  date: string;
  time: string;
  liters: number;    // для смены — засчитанный срез литров; для хвоста — 0
  gapBefore: number; // незаписанные литры на стыке перед этим звеном (Σ колонок)
  partial: boolean;  // смену разрезала граница интервала (шла во время обнуления/базы)
}

export interface ResetDetail {
  baselineLabel: string;     // откуда считается база
  rows: ResetDetailRow[];    // смены интервала по времени + хвост последним
  totalShiftLiters: number;  // Σ записанных литров смен
  physicalDispensed: number; // Σ (показание − база) по колонкам
  diff: number;              // physicalDispensed − totalShiftLiters (= Σ зазоров + хвост)
}

/**
 * Разбор сверки одного обнуления: раскладывает расхождение на зазоры между сменами
 * (начало смены − конец предыдущей) и хвост (показания обнуления − конец последней смены).
 * Внутри смены литры = конец−начало по определению, поэтому незаписанный газ виден только
 * на стыках. Возвращает null, если у обнуления нет показаний или базы для сверки.
 */
export function reconcileResetDetail(
  resetId: string,
  resets: TankReset[],
  shifts: Shift[],
): ResetDetail | null {
  const sorted = [...resets].sort((a, b) => ts(a.date, a.time) - ts(b.date, b.time));
  const idx = sorted.findIndex(r => r.id === resetId);
  if (idx < 0) return null;
  const reset = sorted[idx];
  const readings = reset.pumpReadings ?? [];
  if (readings.length === 0) return null;
  const count = readings.length;

  const firstShift = [...shifts].sort(
    (a, b) => ts(a.startDate, a.startTime) - ts(b.startDate, b.startTime))[0];
  const base = reconBaseline(sorted[idx - 1], firstShift, count);
  if (!base) return null;
  const bSum = base.sum;
  const rSum = readings.reduce((sum, v) => sum + (v ?? 0), 0);

  // Смены, чей диапазон показаний пересекает интервал [bSum; rSum], по возрастанию старта.
  const overlapping = shifts
    .map(s => ({ s, a: shiftStartSum(s, count), b: shiftEndSum(s, count) }))
    .filter(x => x.b > bSum && x.a < rSum)
    .sort((x, y) => x.a - y.a);

  const rows: ResetDetailRow[] = [];
  let covered = bSum;       // докуда показания уже покрыты сменами
  let totalRecorded = 0;
  for (const { s, a, b } of overlapping) {
    const lo = Math.max(a, bSum);
    const hi = Math.min(b, rSum);
    const contribution = round2(hi - lo);   // срез смены внутри интервала
    rows.push({
      kind: 'shift', date: s.endDate, time: s.endTime,
      liters: contribution,
      gapBefore: round2(lo - covered),       // непокрытый диапазон перед сменой
      partial: a < bSum || b > rSum,         // смену разрезала граница интервала
    });
    covered = Math.max(covered, hi);
    totalRecorded += contribution;
  }
  rows.push({
    kind: 'tail', date: reset.date, time: reset.time,
    liters: 0, gapBefore: round2(rSum - covered), partial: false,
  });

  const physicalDispensed = round2(rSum - bSum);
  return {
    baselineLabel: base.label,
    rows,
    totalShiftLiters: round2(totalRecorded),
    physicalDispensed,
    diff: round2(physicalDispensed - totalRecorded),
  };
}

/**
 * Остаток до и после конкретной смены — для контроля прямо в форме.
 * `shifts` — все прочие смены (без редактируемой). Приход, чужие смены и обнуления,
 * случившиеся до конца этой смены, формируют остаток «до». Если перед концом смены
 * было обнуление — отсчёт идёт от нуля с момента последнего такого обнуления.
 */
export function balanceAroundShift(opts: {
  initialStock: number;
  deliveries: GasDelivery[];
  otherShifts: Shift[];
  resets?: TankReset[];
  shiftEnd: number;     // метка времени конца смены
  shiftLiters: number;  // реализация этой смены
}): { before: number; after: number } {
  const { initialStock, deliveries, otherShifts, resets = [], shiftEnd, shiftLiters } = opts;

  // Последнее обнуление не позже конца смены — точка отсчёта.
  let resetAt = -Infinity;
  for (const r of resets) {
    const t = ts(r.date, r.time);
    if (t <= shiftEnd && t > resetAt) resetAt = t;
  }
  const hasReset = resetAt > -Infinity;

  let before = hasReset ? 0 : initialStock;
  for (const d of deliveries) {
    const t = ts(d.date, d.time);
    if (t <= shiftEnd && t > resetAt) before += d.liters;
  }
  for (const s of otherShifts) {
    const t = ts(s.endDate, s.endTime);
    if (t <= shiftEnd && t > resetAt) before -= s.totalLiters;
  }
  before = round2(before);
  return { before, after: round2(before - shiftLiters) };
}
