export interface Operator {
  id: string;
  name: string;
  active: boolean;
}

export interface PumpReading {
  pumpNumber: number;
  start: number;
  end: number;
  volume: number; // calculated
}

// Тип смены: сутки | день | ночь — определяет зарплатную ставку.
export type ShiftType = 'full' | 'day' | 'night';

export const SHIFT_TYPE_LABELS: Record<ShiftType, string> = {
  full: 'Сутки',
  day: 'День',
  night: 'Ночь',
};

export interface Shift {
  id: string;
  operatorId: string;
  receivedById?: string;
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  shiftType: ShiftType;
  pumps: PumpReading[];
  
  // Ввод владельца — только литры и безнал
  voucherLiters: number;
  cardLiters: number;
  discountLiters: number;
  kaspiQR: number;
  kaspiTransfer: number;

  // Цены 107/112 — снапшот смены (берётся из настроек при создании)
  discountPrice: number;
  regularPrice: number;

  // Calculated fields — строки «как на листе»
  totalLiters: number;
  discountAmount: number;   // наличные по 107 = дисконт (л) × 107
  remainderLiters: number;  // остаток (л)
  baseAmount: number;       // общая сумма по 112 = остаток × 112
  cashByBase: number;       // наличные по 112 (может быть < 0)
  cashByDiscount: number;   // наличные по 107 (= discountAmount)
  totalCash: number;        // ИТОГО НАЛИЧНЫМИ
  totalRevenue: number;     // выручка всего (для журнала/отчёта)

  // Зарплата за смену (считает бэк по настройкам)
  baseSalary: number;   // ставка по типу смены
  bonus: number;        // ступенчатый бонус за объём
  payout: number;       // итого за смену = ставка + бонус
}

// Общие цены 107/112 (раздел «Настройки»).
export interface FuelPrice {
  discountPrice: number;
  basePrice: number;
}

export interface BonusTier {
  thresholdLiters: number;
  bonusAmount: number;
}

export interface AppSettings {
  rateFull: number;
  rateDay: number;
  rateNight: number;
  defaultDiscountPrice: number;
  defaultBasePrice: number;
  initialStockLiters: number;   // начальный остаток газа в резервуаре
  tankCapacityLiters: number;   // объём резервуара (0 = без контроля перелива)
  measurementToleranceLiters: number; // погрешность замера при заливке (л)
  bonusTiers: BonusTier[];
}

// Приход газа (поставка в резервуар).
export interface GasDelivery {
  id: string;
  date: string;        // ISO ГГГГ-ММ-ДД
  time: string;        // ЧЧ:ММ
  liters: number;
  supplier?: string;
  note?: string;
}

// Обнуление резервуара (газ закончился — остаток сброшен в ноль).
export interface TankReset {
  id: string;
  date: string;          // ISO ГГГГ-ММ-ДД
  time: string;          // ЧЧ:ММ
  note?: string;
  pumpReadings: number[]; // показания колонок 1,2,3 на момент обнуления
}

export interface MonthlyOperatorStats {
  operatorId: string;
  operatorName: string;
  shiftsCount: number;
  totalLiters: number;
  voucherLiters: number;
  totalRevenue: number;
  baseSalary: number;
  bonus: number;
  totalPayout: number;
}
