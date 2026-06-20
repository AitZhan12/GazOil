import { AppSettings, ShiftType } from '../types';

// Округление до сотых (HALF_UP), как в учёте.
export function round2(num: number): number {
  return Math.round((num + Number.EPSILON) * 100) / 100;
}

// Блок «ИЗ НИХ» бумажного листа: владелец вводит литры и безнал, цены 107/112 —
// снапшот смены. Один в один с бэковым ShiftCalculator.
export function calculateShiftFields(
  pumps: Array<{ start: number; end: number }>,
  voucherLiters: number,
  cardLiters: number,
  discountLiters: number,
  discountPrice: number,
  regularPrice: number,
  kaspiQR: number,
  kaspiTransfer: number
) {
  // Итого литров со всех колонок
  const totalLiters = pumps.reduce((sum, pump) => sum + (pump.end - pump.start), 0);

  // Остаток (литр) = итого − дисконт − талоны − карта
  const remainderLiters = totalLiters - discountLiters - voucherLiters - cardLiters;

  // Дисконтная сумма (наличные по 107) = дисконт (л) × 107
  const discountAmount = discountLiters * discountPrice;

  // Общая сумма по 112 = остаток × 112
  const baseAmount = remainderLiters * regularPrice;

  // Выручка всего (для журнала/отчёта)
  const totalRevenue = discountAmount + baseAmount;

  // Наличные по 112 = общая сумма по 112 − безнал. Бывает отрицательной
  // (Kaspi QR > суммы по 112) — это нормально, не клампим.
  const cashByBase = baseAmount - kaspiQR - kaspiTransfer;
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
