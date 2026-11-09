import { AppSettings, ShiftType } from '../types';

// Округление до сотых (HALF_UP), как в учёте.
export function round2(num: number): number {
  return Math.round((num + Number.EPSILON) * 100) / 100;
}

// Блок «ИЗ НИХ» бумажного листа: владелец вводит литры и безнал, цены 107/112 —
// снапшот смены. Один в один с бэковым ShiftCalculator.
export function calculateShiftFields(
  pumps: Array<{ start: number; end: number; discountLiters: number; discountPrice: number; regularPrice: number }>,
  voucherLiters: number,
  cardLiters: number,
  kaspiQR: number,
  kaspiTransfer: number,
  halykQR: number,
  halykTransfer: number
) {
  // Итого литров со всех колонок
  const totalLiters = pumps.reduce((sum, pump) => sum + (pump.end - pump.start), 0);

  const regularBeforeShared = pumps.map(p => Math.max(0, (p.end - p.start) - p.discountLiters));
  const totalRegularBeforeShared = regularBeforeShared.reduce((sum, value) => sum + value, 0);
  const sharedDeductions = voucherLiters + cardLiters;
  const discountAmount = pumps.reduce((sum, pump) => sum + pump.discountLiters * pump.discountPrice, 0);
  const baseAmount = pumps.reduce((sum, pump, index) => {
    const shared = totalRegularBeforeShared === 0
      ? 0
      : sharedDeductions * regularBeforeShared[index] / totalRegularBeforeShared;
    return sum + (regularBeforeShared[index] - shared) * pump.regularPrice;
  }, 0);
  const remainderLiters = regularBeforeShared.reduce((sum, value) => sum + value, 0) - sharedDeductions;

  // Выручка всего (для журнала/отчёта)
  const totalRevenue = discountAmount + baseAmount;

  // Наличные по 112 = общая сумма по 112 − безнал. Бывает отрицательной
  // (Kaspi QR > суммы по 112) — это нормально, не клампим.
  const cashByBase = baseAmount - kaspiQR - kaspiTransfer - halykQR - halykTransfer;
  // Наличные по 107 = дисконтная сумма
  const cashByDiscount = discountAmount;
  // ИТОГО НАЛИЧНЫМИ = наличные по 112 + наличные по 107
  const totalCash = cashByBase + cashByDiscount;

  // Всё — до сотых, чтобы превью совпадало с сохранённым на бэке.
  return {
    totalLiters: round2(totalLiters),
    discountAmount: round2(discountAmount),
    remainderLiters: round2(remainderLiters),
    baseAmount: round2(baseAmount),
    cashByBase: round2(cashByBase),
    cashByDiscount: round2(cashByDiscount),
    totalCash: round2(totalCash),
    totalRevenue: round2(totalRevenue),
  };
}

// Ставка за смену по её типу (из настроек владельца).
export function salaryRateFor(settings: AppSettings | null, type: ShiftType): number {
  if (!settings) return 0;
  if (type === 'full') return settings.rateFull;
  if (type === 'day') return settings.rateDay;
  return settings.rateNight;
}

// Бонус за объём: высшая ступень, чью планку перешагнул объём (ниже минимума — 0).
export function bonusForLiters(settings: AppSettings | null, liters: number): number {
  if (!settings || !settings.bonusTiers?.length) return 0;
  let best = 0;
  let bestThreshold = -1;
  for (const tier of settings.bonusTiers) {
    if (liters >= tier.thresholdLiters && tier.thresholdLiters > bestThreshold) {
      bestThreshold = tier.thresholdLiters;
      best = tier.bonusAmount;
    }
  }
  return best;
}

export function formatNumber(num: number, decimals: number = 0): string {
  const fixed = num.toFixed(decimals);
  const parts = fixed.split('.');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return parts.join('.');
}

export function formatCurrency(amount: number): string {
  return `${formatNumber(amount, 2)} ₸`;
}

export function formatLiters(liters: number): string {
  return `${formatNumber(liters, 2)} л`;
}
