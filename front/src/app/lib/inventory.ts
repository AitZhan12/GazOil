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

/**
 * Сверяет каждое обнуление: разница показаний колонок с прошлой базой = сколько газа
 * физически прошло через счётчики; сравнивается с суммой литров смен за тот же интервал.
 * База — предыдущее обнуление с показаниями, а для самого первого — стартовые показания
 * самой ранней смены. Обнуления без показаний (или без базы) в результат не попадают.
 */
export function reconcileResets(
  resets: TankReset[],
  shifts: Shift[],
  tolerance = 0,
): Map<string, ResetReconciliation> {
  const result = new Map<string, ResetReconciliation>();
  const sorted = [...resets].sort((a, b) => ts(a.date, a.time) - ts(b.date, b.time));

  // Самая ранняя смена — её стартовые показания служат базой для первого обнуления.
  const firstShift = [...shifts].sort(
    (a, b) => ts(a.startDate, a.startTime) - ts(b.startDate, b.startTime))[0];

  sorted.forEach((reset, i) => {
    const readings = reset.pumpReadings ?? [];
    if (readings.length === 0) return; // нечего сверять
    const at = ts(reset.date, reset.time);

    const prev = sorted[i - 1];
    let baseAt: number;
    let baseReadingFor: (pump: number) => number | null;

    if (prev && (prev.pumpReadings?.length ?? 0) > 0) {
      baseAt = ts(prev.date, prev.time);
      baseReadingFor = (pump) => prev.pumpReadings[pump - 1] ?? null;
    } else if (!prev && firstShift) {
      baseAt = ts(firstShift.startDate, firstShift.startTime);
      baseReadingFor = (pump) => firstShift.pumps.find(p => p.pumpNumber === pump)?.start ?? null;
    } else {
      return; // нет базы для сверки
    }

    // Физически прошло через колонки = Σ (показание − база) по колонкам.
    let physical = 0;
    let baselineOk = true;
    readings.forEach((val, idx) => {
      const base = baseReadingFor(idx + 1);
      if (base === null) { baselineOk = false; return; }
      physical += val - base;
    });
    if (!baselineOk) return;

    // Записано продано = Σ литров смен, закончившихся в интервале (baseAt, at].
    const recorded = shifts.reduce((sum, s) => {
      const e = ts(s.endDate, s.endTime);
      return e > baseAt && e <= at ? sum + s.totalLiters : sum;
    }, 0);

    const diff = round2(physical - recorded);
    result.set(reset.id, {
      physicalDispensed: round2(physical),
      recordedSold: round2(recorded),
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
  liters: number;   // для смены — записанные литры; для хвоста — 0
  gapBefore: number; // незаписанные литры на стыке перед этим звеном (Σ колонок)
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
  const at = ts(reset.date, reset.time);
  const pumpNums = readings.map((_, i) => i + 1);

  // База: предыдущее обнуление с показаниями, иначе старт самой ранней смены.
  const prev = sorted[idx - 1];
  let baseAt: number;
  let baseReadingFor: (pump: number) => number | null;
  let baselineLabel: string;
  if (prev && (prev.pumpReadings?.length ?? 0) > 0) {
    baseAt = ts(prev.date, prev.time);
    baseReadingFor = (p) => prev.pumpReadings[p - 1] ?? null;
    baselineLabel = `Прошлое обнуление — ${prev.date} ${prev.time}`;
  } else {
    const firstShift = [...shifts].sort(
      (a, b) => ts(a.startDate, a.startTime) - ts(b.startDate, b.startTime))[0];
    if (!firstShift) return null;
    baseAt = ts(firstShift.startDate, firstShift.startTime);
    baseReadingFor = (p) => firstShift.pumps.find(x => x.pumpNumber === p)?.start ?? null;
    baselineLabel = `Старт первой смены — ${firstShift.startDate} ${firstShift.startTime}`;
  }

  let baseOk = true;
  const baseSum = pumpNums.reduce((sum, p) => {
    const v = baseReadingFor(p);
    if (v === null) baseOk = false;
    return sum + (v ?? 0);
  }, 0);
  if (!baseOk) return null;

  const resetSum = pumpNums.reduce((sum, p) => sum + (readings[p - 1] ?? 0), 0);
  const startSum = (s: Shift) => pumpNums.reduce((sum, p) => sum + (s.pumps.find(x => x.pumpNumber === p)?.start ?? 0), 0);
  const endSum = (s: Shift) => pumpNums.reduce((sum, p) => sum + (s.pumps.find(x => x.pumpNumber === p)?.end ?? 0), 0);

  const inInterval = shifts
    .filter(s => { const e = ts(s.endDate, s.endTime); return e > baseAt && e <= at; })
    .sort((a, b) => ts(a.endDate, a.endTime) - ts(b.endDate, b.endTime));

  const rows: ResetDetailRow[] = [];
  let prevEnd = baseSum;
  let totalShiftLiters = 0;
  for (const s of inInterval) {
    rows.push({
      kind: 'shift', date: s.endDate, time: s.endTime,
      liters: round2(s.totalLiters), gapBefore: round2(startSum(s) - prevEnd),
    });
    prevEnd = endSum(s);
    totalShiftLiters += s.totalLiters;
  }
  rows.push({
    kind: 'tail', date: reset.date, time: reset.time,
    liters: 0, gapBefore: round2(resetSum - prevEnd),
  });

  const physicalDispensed = round2(resetSum - baseSum);
  return {
    baselineLabel,
    rows,
    totalShiftLiters: round2(totalShiftLiters),
    physicalDispensed,
    diff: round2(physicalDispensed - totalShiftLiters),
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
