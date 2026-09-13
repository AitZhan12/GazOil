import { useState, useMemo, useEffect } from 'react';
import { Download, FileText, Pencil, Printer, Save } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { getShifts, getOperators } from '../lib/storage';
import { formatCurrency, formatLiters, formatNumber, round2 } from '../lib/calculations';
import { downloadExcel, printPdf } from '../lib/export';
import { MonthlyOperatorStats, Operator, Shift, SHIFT_TYPE_LABELS } from '../types';

const ALL = 'all';
const SERVICE_MEMO_KEY = 'gazoil.report.serviceMemoByMonth';
const KASPI_QR_KEY = 'gazoil.report.kaspiQrByMonth';
const PUMP_OVERRIDES_KEY = 'gazoil.report.pumpOverridesByMonth';
const BREAKDOWN_OVERRIDES_KEY = 'gazoil.report.breakdownOverridesByMonth';

type PumpOverrideField = 'start' | 'end';
type BreakdownOverrideField = 'totalLiters' | 'voucherLiters' | 'cardLiters' | 'discountLiters';

function readStoredMap(key: string): Record<string, string> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function readStoredNestedMap(key: string): Record<string, Record<string, string>> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function MonthlyReport() {
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [selectedOperator, setSelectedOperator] = useState<string>(ALL);

  const [operators, setOperators] = useState<Operator[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [error, setError] = useState('');
  const [serviceMemoByMonth, setServiceMemoByMonth] = useState<Record<string, string>>(() => readStoredMap(SERVICE_MEMO_KEY));
  const [kaspiQrByMonth, setKaspiQrByMonth] = useState<Record<string, string>>(() => readStoredMap(KASPI_QR_KEY));
  const [pumpOverridesByMonth, setPumpOverridesByMonth] = useState<Record<string, Record<string, string>>>(() => readStoredNestedMap(PUMP_OVERRIDES_KEY));
  const [breakdownOverridesByMonth, setBreakdownOverridesByMonth] = useState<Record<string, Record<string, string>>>(() => readStoredNestedMap(BREAKDOWN_OVERRIDES_KEY));
  const [isReportEditing, setIsReportEditing] = useState(false);
  const [draftServiceMemo, setDraftServiceMemo] = useState('');
  const [draftKaspiQr, setDraftKaspiQr] = useState('');
  const [draftPumpOverrides, setDraftPumpOverrides] = useState<Record<string, string>>({});
  const [draftBreakdownOverrides, setDraftBreakdownOverrides] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    Promise.all([getOperators(), getShifts()])
      .then(([ops, shs]) => {
        if (cancelled) return;
        setOperators(ops);
        setShifts(shs);
      })
      .catch(e => { if (!cancelled) setError(e instanceof Error ? e.message : 'Ошибка загрузки'); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    window.localStorage.setItem(SERVICE_MEMO_KEY, JSON.stringify(serviceMemoByMonth));
  }, [serviceMemoByMonth]);

  useEffect(() => {
    window.localStorage.setItem(KASPI_QR_KEY, JSON.stringify(kaspiQrByMonth));
  }, [kaspiQrByMonth]);

  useEffect(() => {
    window.localStorage.setItem(PUMP_OVERRIDES_KEY, JSON.stringify(pumpOverridesByMonth));
  }, [pumpOverridesByMonth]);

  useEffect(() => {
    window.localStorage.setItem(BREAKDOWN_OVERRIDES_KEY, JSON.stringify(breakdownOverridesByMonth));
  }, [breakdownOverridesByMonth]);

  // Generate month options (last 12 months)
  const monthOptions = useMemo(() => {
    const options = [];
    const now = new Date();
    for (let i = 0; i < 12; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const label = date.toLocaleDateString('ru-RU', { year: 'numeric', month: 'long' });
      options.push({ value, label });
    }
    return options;
  }, []);

  // Calculate stats per operator (зарплатный акт по всем операторам)
  const operatorStats = useMemo(() => {
    const stats: MonthlyOperatorStats[] = operators
      .filter(op => op.active)
      .map(operator => {
        const operatorShifts = shifts.filter(shift => {
          const shiftMonth = shift.startDate.substring(0, 7);
          return shift.operatorId === operator.id && shiftMonth === selectedMonth;
        });

        const shiftsCount = operatorShifts.length;
        const totalLiters = operatorShifts.reduce((sum, shift) => sum + shift.totalLiters, 0);
        const voucherLiters = operatorShifts.reduce((sum, shift) => sum + shift.voucherLiters, 0);
        const totalRevenue = operatorShifts.reduce((sum, shift) => sum + shift.totalRevenue, 0);

        // ЗП = сумма ставок по типам отработанных смен; бонус = сумма по-сменных
        // ступенчатых бонусов. Оба поля считает бэк по настройкам владельца.
        const baseSalary = operatorShifts.reduce((sum, shift) => sum + (shift.baseSalary ?? 0), 0);
        const bonus = operatorShifts.reduce((sum, shift) => sum + (shift.bonus ?? 0), 0);
        const totalPayout = baseSalary + bonus;
        const cashDebt = shifts
          .filter(shift => shift.operatorId === operator.id && shift.startDate <= `${selectedMonth}-31`)
          .reduce((sum, shift) => {
            const debt = shift.cashCollected
              ? Math.max(0, shift.totalCash - (shift.cashReceived ?? shift.totalCash))
              : Math.max(0, shift.totalCash);
            return sum + debt;
          }, 0);

        return {
          operatorId: operator.id,
          operatorName: operator.name,
          shiftsCount,
          totalLiters,
          voucherLiters,
          totalRevenue,
          baseSalary,
          bonus,
          totalPayout,
          cashDebt,
        };
      });

    return stats;
  }, [operators, shifts, selectedMonth]);

  const monthShifts = useMemo(() => {
    return shifts
      .filter(shift => shift.startDate.substring(0, 7) === selectedMonth)
      .sort((a, b) => (a.startDate + a.startTime).localeCompare(b.startDate + b.startTime));
  }, [shifts, selectedMonth]);

  const parseMoneyInput = (value: string) => {
    const normalized = value.replace(/\s/g, '').replace(',', '.');
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const editableNumber = (value: string | undefined, fallback: number) => {
    return value === undefined || value.trim() === '' ? fallback : parseMoneyInput(value);
  };

  const pumpOverrideKey = (pumpNumber: number, field: PumpOverrideField) => `${pumpNumber}.${field}`;

  const setPumpOverride = (pumpNumber: number, field: PumpOverrideField, value: string) => {
    const key = pumpOverrideKey(pumpNumber, field);
    if (isReportEditing) {
      setDraftPumpOverrides(prev => ({
        ...prev,
        [key]: value,
      }));
      return;
    }

    setPumpOverridesByMonth(prev => ({
      ...prev,
      [selectedMonth]: {
        ...(prev[selectedMonth] ?? {}),
        [key]: value,
      },
    }));
  };

  const setBreakdownOverride = (field: BreakdownOverrideField, value: string) => {
    if (isReportEditing) {
      setDraftBreakdownOverrides(prev => ({
        ...prev,
        [field]: value,
      }));
      return;
    }

    setBreakdownOverridesByMonth(prev => ({
      ...prev,
      [selectedMonth]: {
        ...(prev[selectedMonth] ?? {}),
        [field]: value,
      },
    }));
  };

  const reportCalculator = useMemo(() => {
    const pumpOverrides = isReportEditing ? draftPumpOverrides : pumpOverridesByMonth[selectedMonth] ?? {};
    const breakdownOverrides = isReportEditing ? draftBreakdownOverrides : breakdownOverridesByMonth[selectedMonth] ?? {};

    const pumpRows = [1, 2, 3].map(pumpNumber => {
      const withPump = monthShifts.filter(shift => shift.pumps.some(pump => pump.pumpNumber === pumpNumber));
      const first = withPump[0]?.pumps.find(pump => pump.pumpNumber === pumpNumber);
      const last = withPump[withPump.length - 1]?.pumps.find(pump => pump.pumpNumber === pumpNumber);
      const autoStart = first?.start ?? 0;
      const autoEnd = last?.end ?? 0;
      const start = editableNumber(pumpOverrides[pumpOverrideKey(pumpNumber, 'start')], autoStart);
      const end = editableNumber(pumpOverrides[pumpOverrideKey(pumpNumber, 'end')], autoEnd);
      return { pumpNumber, start, end, autoStart, autoEnd, sales: round2(end - start) };
    });

    const regularPriceSet = new Set(monthShifts.map(shift => shift.regularPrice));
    const discountPriceSet = new Set(monthShifts.map(shift => shift.discountPrice));
    const autoTotalLiters = round2(monthShifts.reduce((sum, shift) => sum + shift.totalLiters, 0));
    const totalByReadings = round2(pumpRows.reduce((sum, row) => sum + row.sales, 0));
    const autoVoucherLiters = round2(monthShifts.reduce((sum, shift) => sum + shift.voucherLiters, 0));
    const autoCardLiters = round2(monthShifts.reduce((sum, shift) => sum + shift.cardLiters, 0));
    const autoDiscountLiters = round2(monthShifts.reduce((sum, shift) => sum + shift.discountLiters, 0));
    const autoRegularLiters = round2(monthShifts.reduce((sum, shift) => sum + shift.remainderLiters, 0));
    const autoRegularAmount = round2(monthShifts.reduce((sum, shift) => sum + shift.baseAmount, 0));
    const autoDiscountAmount = round2(monthShifts.reduce((sum, shift) => sum + shift.discountAmount, 0));
    const hasManualBreakdown = (['totalLiters', 'voucherLiters', 'cardLiters', 'discountLiters'] as BreakdownOverrideField[])
      .some(field => breakdownOverrides[field] !== undefined && breakdownOverrides[field].trim() !== '');
    const totalLiters = round2(editableNumber(breakdownOverrides.totalLiters, autoTotalLiters));
    const voucherLiters = round2(editableNumber(breakdownOverrides.voucherLiters, autoVoucherLiters));
    const cardLiters = round2(editableNumber(breakdownOverrides.cardLiters, autoCardLiters));
    const discountLiters = round2(editableNumber(breakdownOverrides.discountLiters, autoDiscountLiters));
    const regularUnitPrice = regularPriceSet.size === 1 ? [...regularPriceSet][0] ?? 0 : autoRegularAmount / (autoRegularLiters || 1);
    const discountUnitPrice = discountPriceSet.size === 1 ? [...discountPriceSet][0] ?? 0 : autoDiscountAmount / (autoDiscountLiters || 1);
    const regularLiters = hasManualBreakdown ? round2(totalLiters - voucherLiters - cardLiters - discountLiters) : autoRegularLiters;
    const regularAmount = hasManualBreakdown ? round2(regularLiters * regularUnitPrice) : autoRegularAmount;
    const discountAmount = hasManualBreakdown ? round2(discountLiters * discountUnitPrice) : autoDiscountAmount;
    const autoKaspiQR = round2(monthShifts.reduce((sum, shift) => sum + shift.kaspiQR, 0));
    const kaspiTransfer = round2(monthShifts.reduce((sum, shift) => sum + shift.kaspiTransfer, 0));
    const totalRevenue = round2(regularAmount + discountAmount);
    const serviceMemoInput = isReportEditing ? draftServiceMemo : serviceMemoByMonth[selectedMonth] ?? '';
    const serviceMemo = parseMoneyInput(serviceMemoInput);
    const kaspiQrInput = isReportEditing ? draftKaspiQr : kaspiQrByMonth[selectedMonth] ?? '';
    const effectiveKaspiQR = kaspiQrInput.trim() === '' ? autoKaspiQR : parseMoneyInput(kaspiQrInput);
    const cashToDeposit = round2(totalRevenue - effectiveKaspiQR - kaspiTransfer - serviceMemo);

    return {
      pumpRows,
      autoTotalLiters,
      totalLiters,
      totalByReadings,
      autoVoucherLiters,
      voucherLiters,
      autoCardLiters,
      cardLiters,
      autoDiscountLiters,
      discountLiters,
      regularLiters,
      regularAmount,
      discountAmount,
      totalRevenue,
      autoKaspiQR,
      effectiveKaspiQR,
      kaspiTransfer,
      serviceMemo,
      cashToDeposit,
      regularPriceLabel: regularPriceSet.size === 1 ? `${formatNumber([...regularPriceSet][0] ?? 0, 0)} ₸` : 'по цене смены',
      discountPriceLabel: discountPriceSet.size === 1 ? `${formatNumber([...discountPriceSet][0] ?? 0, 0)} ₸` : 'по цене смены',
    };
  }, [monthShifts, selectedMonth, serviceMemoByMonth, kaspiQrByMonth, pumpOverridesByMonth, breakdownOverridesByMonth, isReportEditing, draftServiceMemo, draftKaspiQr, draftPumpOverrides, draftBreakdownOverrides]);

  // Calculate totals
  const totals = useMemo(() => {
    return operatorStats.reduce(
      (acc, stat) => ({
        shiftsCount: acc.shiftsCount + stat.shiftsCount,
        totalLiters: acc.totalLiters + stat.totalLiters,
        voucherLiters: acc.voucherLiters + stat.voucherLiters,
        totalRevenue: acc.totalRevenue + stat.totalRevenue,
        baseSalary: acc.baseSalary + stat.baseSalary,
        bonus: acc.bonus + stat.bonus,
        totalPayout: acc.totalPayout + stat.totalPayout,
        cashDebt: acc.cashDebt + stat.cashDebt,
      }),
      {
        shiftsCount: 0,
        totalLiters: 0,
        voucherLiters: 0,
        totalRevenue: 0,
        baseSalary: 0,
        bonus: 0,
        totalPayout: 0,
        cashDebt: 0,
      }
    );
  }, [operatorStats]);

  // Детализация по одному оператору — список его смен за месяц.
  const operatorShifts = useMemo(() => {
    if (selectedOperator === ALL) return [];
    return shifts
      .filter(shift => {
        const shiftMonth = shift.startDate.substring(0, 7);
        return shift.operatorId === selectedOperator && shiftMonth === selectedMonth;
      })
      .sort((a, b) => (a.startDate + a.startTime).localeCompare(b.startDate + b.startTime));
  }, [shifts, selectedOperator, selectedMonth]);

  const selectedStat = useMemo(
    () => operatorStats.find(s => s.operatorId === selectedOperator),
    [operatorStats, selectedOperator]
  );

  const selectedMonthLabel = monthOptions.find(opt => opt.value === selectedMonth)?.label || '';
  const selectedOperatorName =
    operators.find(op => op.id === selectedOperator)?.name || '';
  const serviceMemoInput = isReportEditing ? draftServiceMemo : serviceMemoByMonth[selectedMonth] ?? '';
  const kaspiQrInput = isReportEditing ? draftKaspiQr : kaspiQrByMonth[selectedMonth] ?? '';
  const pumpOverrides = isReportEditing ? draftPumpOverrides : pumpOverridesByMonth[selectedMonth] ?? {};
  const breakdownOverrides = isReportEditing ? draftBreakdownOverrides : breakdownOverridesByMonth[selectedMonth] ?? {};

  const handleMonthChange = (value: string) => {
    setIsReportEditing(false);
    setSelectedMonth(value);
  };

  const handleStartReportEdit = () => {
    setDraftServiceMemo(serviceMemoByMonth[selectedMonth] ?? '');
    setDraftKaspiQr(kaspiQrByMonth[selectedMonth] ?? '');
    setDraftPumpOverrides(pumpOverridesByMonth[selectedMonth] ?? {});
    setDraftBreakdownOverrides(breakdownOverridesByMonth[selectedMonth] ?? {});
    setIsReportEditing(true);
  };

  const handleSaveReportEdit = () => {
    setServiceMemoByMonth(prev => ({ ...prev, [selectedMonth]: draftServiceMemo }));
    setKaspiQrByMonth(prev => ({ ...prev, [selectedMonth]: draftKaspiQr }));
    setPumpOverridesByMonth(prev => ({ ...prev, [selectedMonth]: draftPumpOverrides }));
    setBreakdownOverridesByMonth(prev => ({ ...prev, [selectedMonth]: draftBreakdownOverrides }));
    setIsReportEditing(false);
  };

  const formatDate = (iso: string) => {
    const [y, m, d] = iso.split('-');
    return d && m && y ? `${d}.${m}.${y}` : iso;
  };

  const downloadWord = (html: string, filename: string) => {
    const doc = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
        <head><meta charset="utf-8"><title>${filename}</title></head>
        <body>${html}</body>
      </html>`;
    const blob = new Blob(['\ufeff', doc], { type: 'application/msword;charset=utf-8' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const money = (value: number) => formatNumber(value, 2);
  const liters = (value: number) => formatNumber(value, 2);

  const handleWordExport = () => {
    const calc = reportCalculator;
    const pumpRows = calc.pumpRows.map(row => `
      <tr>
        <td>Колонка ${row.pumpNumber}</td>
        <td style="text-align:right">${liters(row.start)}</td>
        <td style="text-align:right">${liters(row.end)}</td>
        <td style="text-align:right"><b>${liters(row.sales)}</b></td>
      </tr>`).join('');

    downloadWord(`
      <h2>Отчетный калькулятор</h2>
      <p><b>Период:</b> ${selectedMonthLabel}</p>
      <table border="1" cellspacing="0" cellpadding="6" style="border-collapse:collapse;width:100%">
        <tr><th>Показания</th><th>Начало</th><th>Конец</th><th>Продажа, л</th></tr>
        ${pumpRows}
        <tr><td colspan="3"><b>Итого по показаниям</b></td><td style="text-align:right"><b>${liters(calc.totalByReadings)}</b></td></tr>
      </table>
      <br />
      <table border="1" cellspacing="0" cellpadding="6" style="border-collapse:collapse;width:100%">
        <tr><td>Продажа по сменам</td><td style="text-align:right">${liters(calc.totalLiters)} л</td></tr>
        <tr><td>Талоны</td><td style="text-align:right">${liters(calc.voucherLiters)} л</td></tr>
        <tr><td>Товарная карта</td><td style="text-align:right">${liters(calc.cardLiters)} л</td></tr>
        <tr><td>Дисконтная карта</td><td style="text-align:right">${liters(calc.discountLiters)} л</td></tr>
        <tr><td>По ${calc.regularPriceLabel}</td><td style="text-align:right">${liters(calc.regularLiters)} л = ${money(calc.regularAmount)} ₸</td></tr>
        <tr><td>По ${calc.discountPriceLabel}</td><td style="text-align:right">${liters(calc.discountLiters)} л = ${money(calc.discountAmount)} ₸</td></tr>
        <tr><td>Kaspi QR</td><td style="text-align:right">${money(calc.effectiveKaspiQR)} ₸</td></tr>
        <tr><td>Kaspi перевод</td><td style="text-align:right">${money(calc.kaspiTransfer)} ₸</td></tr>
        <tr><td>Служебная записка</td><td style="text-align:right">${money(calc.serviceMemo)} ₸</td></tr>
        <tr><td><b>К внесению в кассу</b></td><td style="text-align:right"><b>${money(calc.cashToDeposit)} ₸</b></td></tr>
      </table>
    `, `Отчетный_калькулятор_${selectedMonthLabel}.doc`);
  };

  const handleExport = () => {
    // Выгрузка по одному оператору — список смен с детализацией.
    if (selectedOperator !== ALL) {
      const headers = [
        'Дата',
        'Тип смены',
        'Реализация (л)',
        'Талоны (л)',
        'ЗП база (₸)',
        'Бонус (₸)',
        'К выплате (₸)',
        'Долг по кассе на конец месяца (₸)',
      ];
      const rows = operatorShifts.map(s => [
        formatDate(s.startDate),
        SHIFT_TYPE_LABELS[s.shiftType],
        s.totalLiters.toFixed(2),
        s.voucherLiters.toFixed(2),
        (s.baseSalary ?? 0).toFixed(0),
        (s.bonus ?? 0).toFixed(0),
        ((s.baseSalary ?? 0) + (s.bonus ?? 0)).toFixed(0),
      ]);
      rows.push([
        'ИТОГО',
        `${selectedStat?.shiftsCount ?? operatorShifts.length} смен`,
        (selectedStat?.totalLiters ?? 0).toFixed(2),
        (selectedStat?.voucherLiters ?? 0).toFixed(2),
        (selectedStat?.baseSalary ?? 0).toFixed(0),
        (selectedStat?.bonus ?? 0).toFixed(0),
        (selectedStat?.totalPayout ?? 0).toFixed(0),
        (selectedStat?.cashDebt ?? 0).toFixed(0),
      ]);
      downloadExcel([headers, ...rows], `Расчет_${selectedOperatorName}_${selectedMonthLabel}.xls`);
      return;
    }

    // Выгрузка зарплатного акта по всем операторам.
    const headers = [
      'Оператор',
      'Смен',
      'Литров продано',
      'Талонов (л)',
      'ЗП база (₸)',
      'Бонус (₸)',
      'Итого к выплате (₸)',
      'Долг по кассе на конец месяца (₸)',
    ];
    const rows = operatorStats.map(stat => [
      stat.operatorName,
      stat.shiftsCount,
      stat.totalLiters.toFixed(2),
      stat.voucherLiters.toFixed(2),
      stat.baseSalary.toFixed(0),
      stat.bonus.toFixed(0),
      stat.totalPayout.toFixed(0),
      stat.cashDebt.toFixed(0),
    ]);
    rows.push([
      'ИТОГО',
      totals.shiftsCount,
      totals.totalLiters.toFixed(2),
      totals.voucherLiters.toFixed(2),
      totals.baseSalary.toFixed(0),
      totals.bonus.toFixed(0),
      totals.totalPayout.toFixed(0),
      totals.cashDebt.toFixed(0),
    ]);
    downloadExcel([headers, ...rows], `Зарплатный_акт_${selectedMonthLabel}.xls`);
  };

  const handlePdfExport = () => {
    const title = isSingle ? `Расчет по оператору ${selectedOperatorName}` : 'Зарплатный акт';
    const rowsHtml = isSingle
      ? operatorShifts.map(s => `
          <tr>
            <td>${formatDate(s.startDate)}</td>
            <td>${SHIFT_TYPE_LABELS[s.shiftType]}</td>
            <td class="num">${formatLiters(s.totalLiters)}</td>
            <td class="num">${formatLiters(s.voucherLiters)}</td>
            <td class="num">${formatCurrency(s.baseSalary ?? 0)}</td>
            <td class="num">${formatCurrency(s.bonus ?? 0)}</td>
            <td class="num">${formatCurrency((s.baseSalary ?? 0) + (s.bonus ?? 0))}</td>
          </tr>`).join('')
      : operatorStats.map(stat => `
          <tr>
            <td>${stat.operatorName}</td>
            <td class="num">${stat.shiftsCount}</td>
            <td class="num">${formatLiters(stat.totalLiters)}</td>
            <td class="num">${formatLiters(stat.voucherLiters)}</td>
            <td class="num">${formatCurrency(stat.baseSalary)}</td>
            <td class="num">${formatCurrency(stat.bonus)}</td>
            <td class="num">${formatCurrency(stat.totalPayout)}</td>
            <td class="num">${formatCurrency(stat.cashDebt)}</td>
          </tr>`).join('');
    const total = isSingle ? selectedStat : totals;

    printPdf(`${title} ${selectedMonthLabel}`, `
      <h1>${title}</h1>
      <p>Период: ${selectedMonthLabel}${isSingle ? ` · ${selectedOperatorName}` : ''}</p>
      <table>
        <tr>
          <th>${isSingle ? 'Дата' : 'Оператор'}</th>
          <th>${isSingle ? 'Тип' : 'Смен'}</th>
          <th class="num">Реализация</th>
          <th class="num">Талоны</th>
          <th class="num">ЗП база</th>
          <th class="num">Бонус</th>
          <th class="num">К выплате</th>
          ${!isSingle ? '<th class="num">Долг по кассе</th>' : ''}
        </tr>
        ${rowsHtml}
        <tr class="total">
          <td>ИТОГО</td>
          <td class="num">${total?.shiftsCount ?? 0}</td>
          <td class="num">${formatLiters(total?.totalLiters ?? 0)}</td>
          <td class="num">${formatLiters(total?.voucherLiters ?? 0)}</td>
          <td class="num">${formatCurrency(total?.baseSalary ?? 0)}</td>
          <td class="num">${formatCurrency(total?.bonus ?? 0)}</td>
          <td class="num">${formatCurrency(total?.totalPayout ?? 0)}</td>
          ${!isSingle ? `<td class="num">${formatCurrency(total?.cashDebt ?? 0)}</td>` : ''}
        </tr>
      </table>
    `);
  };

  const isSingle = selectedOperator !== ALL;
  const hasData = isSingle ? operatorShifts.length > 0 : totals.shiftsCount > 0;

  const thCell = 'px-4 py-2.5 text-slate-500 border-r border-[#edf0f5] last:border-r-0';
  const thStyle = { fontSize: '11px', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' as const };
  const tdNum = 'px-4 py-2.5 text-right font-mono text-slate-700 border-r border-[#edf0f5]';
  const calcLabel = 'text-slate-500 uppercase tracking-[0.05em]';
  const calcValue = 'font-mono text-slate-900';

  return (
    <div className="space-y-4">
      {error && (
        <div className="px-4 py-2.5 bg-red-50 border border-red-200 rounded-lg text-red-700" style={{ fontSize: '13px' }}>
          {error}
        </div>
      )}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-slate-900" style={{ fontSize: '18px', fontWeight: 600 }}>
            {isSingle ? 'Расчёт по оператору' : 'Зарплатный акт'}
          </h1>
          <p className="text-slate-500 mt-0.5" style={{ fontSize: '12px' }}>
            {isSingle ? `${selectedOperatorName} — ${selectedMonthLabel}` : 'Итоги по операторам за период'}
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <Select value={selectedOperator} onValueChange={setSelectedOperator}>
            <SelectTrigger className="h-8 w-44 sm:w-56 border-[#d1d9e6] bg-white" style={{ fontSize: '13px' }}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL} style={{ fontSize: '13px' }}>Все операторы</SelectItem>
              {operators.filter(op => op.active).map(op => (
                <SelectItem key={op.id} value={op.id} style={{ fontSize: '13px' }}>
                  {op.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={selectedMonth} onValueChange={handleMonthChange}>
            <SelectTrigger className="h-8 w-40 sm:w-52 border-[#d1d9e6] bg-white" style={{ fontSize: '13px' }}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {monthOptions.map(option => (
                <SelectItem key={option.value} value={option.value} style={{ fontSize: '13px' }}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={handleExport} disabled={!hasData} className="gap-1.5 bg-blue-600 hover:bg-blue-700 text-white h-8 px-3" style={{ fontSize: '13px' }}>
            <Download className="size-3.5" />
            Excel
          </Button>
          <Button onClick={handlePdfExport} disabled={!hasData} variant="outline" className="gap-1.5 h-8 px-3 border-[#d1d9e6] bg-white" style={{ fontSize: '13px' }}>
            <Printer className="size-3.5" />
            PDF
          </Button>
        </div>
      </div>

      {/* Карточки-итоги по выбранному оператору */}
      {isSingle && hasData && selectedStat && (
          <div className="grid grid-cols-2 sm:grid-cols-6 gap-3">
          <SummaryCard label="Смен" value={String(selectedStat.shiftsCount)} />
          <SummaryCard label="Реализация" value={`${formatLiters(selectedStat.totalLiters)} л`} />
          <SummaryCard label="ЗП база" value={formatCurrency(selectedStat.baseSalary)} />
            <SummaryCard label="Бонус" value={formatCurrency(selectedStat.bonus)} />
            <SummaryCard label="К выплате" value={formatCurrency(selectedStat.totalPayout)} accent />
            <SummaryCard label="Долг по кассе" value={formatCurrency(selectedStat.cashDebt)} />
        </div>
      )}

      {!hasData ? (
        <div className="bg-white border border-[#d1d9e6] rounded-lg p-12 text-center">
          <p className="text-slate-400" style={{ fontSize: '14px' }}>
            Нет данных {isSingle ? `по «${selectedOperatorName}» ` : ''}за {selectedMonthLabel}
          </p>
        </div>
      ) : isSingle ? (
        /* Детализация по сменам одного оператора */
        <div className="bg-white border border-[#d1d9e6] rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse min-w-[720px]">
              <thead>
                <tr className="bg-[#f8fafc] border-b border-[#d1d9e6]">
                  <th className={`${thCell} text-left`} style={thStyle}>Дата</th>
                  <th className={`${thCell} text-left`} style={thStyle}>Тип</th>
                  <th className={`${thCell} text-right`} style={thStyle}>Реализ. (л)</th>
                  <th className={`${thCell} text-right`} style={thStyle}>Талоны (л)</th>
                  <th className={`${thCell} text-right bg-blue-50`} style={thStyle}>ЗП база</th>
                  <th className={`${thCell} text-right bg-blue-50`} style={thStyle}>Бонус</th>
                  <th className={`${thCell} text-right bg-blue-50`} style={thStyle}>К выплате</th>
                </tr>
              </thead>
              <tbody>
                {operatorShifts.map((s, idx) => {
                  const payout = (s.baseSalary ?? 0) + (s.bonus ?? 0);
                  return (
                    <tr key={s.id} className={`border-b border-[#edf0f5] hover:bg-[#f8fafc] transition-colors ${idx === operatorShifts.length - 1 ? 'border-b-0' : ''}`}>
                      <td className="px-4 py-2.5 text-slate-900 border-r border-[#edf0f5] font-mono" style={{ fontSize: '13px' }}>{formatDate(s.startDate)}</td>
                      <td className="px-4 py-2.5 text-slate-700 border-r border-[#edf0f5]" style={{ fontSize: '13px' }}>{SHIFT_TYPE_LABELS[s.shiftType]}</td>
                      <td className={tdNum} style={{ fontSize: '13px' }}>{formatLiters(s.totalLiters)}</td>
                      <td className={tdNum} style={{ fontSize: '13px' }}>{formatLiters(s.voucherLiters)}</td>
                      <td className="px-4 py-2.5 text-right font-mono text-slate-700 border-r border-[#edf0f5] bg-blue-50/40" style={{ fontSize: '13px' }}>{formatCurrency(s.baseSalary ?? 0)}</td>
                      <td className="px-4 py-2.5 text-right font-mono text-slate-700 border-r border-[#edf0f5] bg-blue-50/40" style={{ fontSize: '13px' }}>{formatCurrency(s.bonus ?? 0)}</td>
                      <td className="px-4 py-2.5 text-right font-mono text-blue-800 bg-blue-50/40" style={{ fontSize: '13px', fontWeight: 600 }}>{formatCurrency(payout)}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-[#f0f2f5] border-t-2 border-[#d1d9e6]">
                  <td className="px-4 py-2.5 text-slate-600 border-r border-[#edf0f5]" style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase' }} colSpan={2}>ИТОГО</td>
                  <td className="px-4 py-2.5 text-right font-mono text-slate-900 border-r border-[#edf0f5]" style={{ fontSize: '13px', fontWeight: 600 }}>{formatLiters(selectedStat?.totalLiters ?? 0)}</td>
                  <td className="px-4 py-2.5 text-right font-mono text-slate-900 border-r border-[#edf0f5]" style={{ fontSize: '13px', fontWeight: 600 }}>{formatLiters(selectedStat?.voucherLiters ?? 0)}</td>
                  <td className="px-4 py-2.5 text-right font-mono text-slate-900 border-r border-[#edf0f5] bg-blue-100/60" style={{ fontSize: '13px', fontWeight: 600 }}>{formatCurrency(selectedStat?.baseSalary ?? 0)}</td>
                  <td className="px-4 py-2.5 text-right font-mono text-slate-900 border-r border-[#edf0f5] bg-blue-100/60" style={{ fontSize: '13px', fontWeight: 600 }}>{formatCurrency(selectedStat?.bonus ?? 0)}</td>
                  <td className="px-4 py-2.5 text-right font-mono text-blue-900 bg-blue-100/60" style={{ fontSize: '14px', fontWeight: 700 }}>{formatCurrency(selectedStat?.totalPayout ?? 0)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      ) : (
        /* Зарплатный акт по всем операторам */
        <div className="bg-white border border-[#d1d9e6] rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse min-w-[900px]">
              <thead>
                <tr className="bg-[#f8fafc] border-b border-[#d1d9e6]">
                  <th className={`${thCell} text-left`} style={thStyle}>Оператор</th>
                  <th className={`${thCell} text-right`} style={thStyle}>Смен</th>
                  <th className={`${thCell} text-right`} style={thStyle}>Реализ. (л)</th>
                  <th className={`${thCell} text-right`} style={thStyle}>Талоны (л)</th>
                  <th className={`${thCell} text-right bg-blue-50`} style={thStyle}>ЗП база</th>
                  <th className={`${thCell} text-right bg-blue-50`} style={thStyle}>Бонус</th>
                  <th className={`${thCell} text-right bg-blue-50`} style={thStyle}>К выплате</th>
                  <th className={`${thCell} text-right bg-red-50`} style={thStyle}>Долг по кассе</th>
                </tr>
              </thead>
              <tbody>
                {operatorStats.map((stat, idx) => (
                  <tr
                    key={stat.operatorId}
                    onClick={() => setSelectedOperator(stat.operatorId)}
                    className={`border-b border-[#edf0f5] hover:bg-[#f8fafc] transition-colors cursor-pointer ${idx === operatorStats.length - 1 ? 'border-b-0' : ''}`}
                  >
                    <td className="px-4 py-2.5 text-slate-900 border-r border-[#edf0f5]" style={{ fontSize: '13px' }}>{stat.operatorName}</td>
                    <td className={tdNum} style={{ fontSize: '13px' }}>{stat.shiftsCount}</td>
                    <td className={tdNum} style={{ fontSize: '13px' }}>{formatLiters(stat.totalLiters)}</td>
                    <td className={tdNum} style={{ fontSize: '13px' }}>{formatLiters(stat.voucherLiters)}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-slate-700 border-r border-[#edf0f5] bg-blue-50/40" style={{ fontSize: '13px' }}>{formatCurrency(stat.baseSalary)}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-slate-700 border-r border-[#edf0f5] bg-blue-50/40" style={{ fontSize: '13px' }}>{formatCurrency(stat.bonus)}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-blue-800 bg-blue-50/40" style={{ fontSize: '13px', fontWeight: 600 }}>{formatCurrency(stat.totalPayout)}</td>
                    <td className={`px-4 py-2.5 text-right font-mono ${stat.cashDebt > 0 ? 'text-red-700 bg-red-50/60 font-semibold' : 'text-slate-500 bg-red-50/40'}`} style={{ fontSize: '13px' }}>{formatCurrency(stat.cashDebt)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-[#f0f2f5] border-t-2 border-[#d1d9e6]">
                  <td className="px-4 py-2.5 text-slate-600 border-r border-[#edf0f5]" style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase' }}>ИТОГО</td>
                  <td className="px-4 py-2.5 text-right font-mono text-slate-900 border-r border-[#edf0f5]" style={{ fontSize: '13px', fontWeight: 600 }}>{totals.shiftsCount}</td>
                  <td className="px-4 py-2.5 text-right font-mono text-slate-900 border-r border-[#edf0f5]" style={{ fontSize: '13px', fontWeight: 600 }}>{formatLiters(totals.totalLiters)}</td>
                  <td className="px-4 py-2.5 text-right font-mono text-slate-900 border-r border-[#edf0f5]" style={{ fontSize: '13px', fontWeight: 600 }}>{formatLiters(totals.voucherLiters)}</td>
                  <td className="px-4 py-2.5 text-right font-mono text-slate-900 border-r border-[#edf0f5] bg-blue-100/60" style={{ fontSize: '13px', fontWeight: 600 }}>{formatCurrency(totals.baseSalary)}</td>
                  <td className="px-4 py-2.5 text-right font-mono text-slate-900 border-r border-[#edf0f5] bg-blue-100/60" style={{ fontSize: '13px', fontWeight: 600 }}>{formatCurrency(totals.bonus)}</td>
                  <td className="px-4 py-2.5 text-right font-mono text-blue-900 bg-blue-100/60" style={{ fontSize: '14px', fontWeight: 700 }}>{formatCurrency(totals.totalPayout)}</td>
                  <td className="px-4 py-2.5 text-right font-mono text-red-800 bg-red-100/60" style={{ fontSize: '14px', fontWeight: 700 }}>{formatCurrency(totals.cashDebt)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {monthShifts.length > 0 && (
        <div className="bg-white border border-[#d1d9e6] rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-[#d1d9e6] bg-slate-50 flex items-center justify-between gap-3 flex-wrap">
            <div>
              <h2 className="text-slate-900" style={{ fontSize: '16px', fontWeight: 700 }}>Отчетный калькулятор</h2>
              <p className="text-slate-500 mt-0.5" style={{ fontSize: '12px' }}>Автоматический расчет кассового отчета за {selectedMonthLabel}</p>
            </div>
            <div className="flex items-center gap-2">
              {isReportEditing ? (
                <Button onClick={handleSaveReportEdit} className="gap-1.5 bg-blue-600 hover:bg-blue-700 text-white h-8 px-3" style={{ fontSize: '13px' }}>
                  <Save className="size-3.5" />
                  Сохранить
                </Button>
              ) : (
                <Button onClick={handleStartReportEdit} variant="outline" className="gap-1.5 h-8 px-3 border-[#d1d9e6] bg-white" style={{ fontSize: '13px' }}>
                  <Pencil className="size-3.5" />
                  Редактировать
                </Button>
              )}
              <Button onClick={handleWordExport} className="gap-1.5 bg-slate-900 hover:bg-slate-800 text-white h-8 px-3" style={{ fontSize: '13px' }}>
                <FileText className="size-3.5" />
                Word
              </Button>
            </div>
          </div>

          <div className="p-4 space-y-4">
            <div>
              <div className="mb-2 text-slate-700" style={{ fontSize: '13px', fontWeight: 600 }}>Показания колонок за месяц</div>
              <div className="overflow-x-auto border border-[#edf0f5] rounded-lg">
                <table className="w-full border-collapse min-w-[620px]">
                  <thead>
                    <tr className="bg-[#f8fafc] border-b border-[#d1d9e6]">
                      <th className={`${thCell} text-left`} style={thStyle}>Колонка</th>
                      <th className={`${thCell} text-right`} style={thStyle}>Начало</th>
                      <th className={`${thCell} text-right`} style={thStyle}>Конец</th>
                      <th className={`${thCell} text-right`} style={thStyle}>Продажа</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportCalculator.pumpRows.map(row => (
                      <tr key={row.pumpNumber} className="border-b border-[#edf0f5] last:border-b-0">
                        <td className="px-4 py-2.5 text-slate-900 border-r border-[#edf0f5]" style={{ fontSize: '13px' }}>Колонка {row.pumpNumber}</td>
                        <td className="px-3 py-2 border-r border-[#edf0f5]">
                          <Input
                            inputMode="decimal"
                            value={pumpOverrides[pumpOverrideKey(row.pumpNumber, 'start')] ?? formatNumber(row.autoStart, 2)}
                            onChange={event => setPumpOverride(row.pumpNumber, 'start', event.target.value)}
                            placeholder={formatNumber(row.autoStart, 2)}
                            disabled={!isReportEditing}
                            className="h-8 bg-white border-[#d1d9e6] font-mono text-right"
                            style={{ fontSize: '13px' }}
                          />
                        </td>
                        <td className="px-3 py-2 border-r border-[#edf0f5]">
                          <Input
                            inputMode="decimal"
                            value={pumpOverrides[pumpOverrideKey(row.pumpNumber, 'end')] ?? formatNumber(row.autoEnd, 2)}
                            onChange={event => setPumpOverride(row.pumpNumber, 'end', event.target.value)}
                            placeholder={formatNumber(row.autoEnd, 2)}
                            disabled={!isReportEditing}
                            className="h-8 bg-white border-[#d1d9e6] font-mono text-right"
                            style={{ fontSize: '13px' }}
                          />
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono text-blue-900 bg-blue-50/50" style={{ fontSize: '13px', fontWeight: 700 }}>{formatLiters(row.sales)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-[#f0f2f5] border-t border-[#d1d9e6]">
                      <td className="px-4 py-2.5 text-slate-600 border-r border-[#edf0f5]" colSpan={3} style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase' }}>Итого по показаниям</td>
                      <td className="px-4 py-2.5 text-right font-mono text-blue-900" style={{ fontSize: '14px', fontWeight: 700 }}>{formatLiters(reportCalculator.totalByReadings)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2 border border-[#edf0f5] rounded-lg overflow-hidden">
                <div className="px-4 py-2.5 bg-[#f8fafc] border-b border-[#edf0f5] text-slate-700" style={{ fontSize: '13px', fontWeight: 600 }}>Разбивка реализации</div>
                <div className="divide-y divide-[#edf0f5]">
                  <CalcInputRow
                    label="Продажа по сменам"
                    value={breakdownOverrides.totalLiters ?? formatNumber(reportCalculator.autoTotalLiters, 2)}
                    placeholder={formatNumber(reportCalculator.autoTotalLiters, 2)}
                    onChange={value => setBreakdownOverride('totalLiters', value)}
                    disabled={!isReportEditing}
                  />
                  <CalcInputRow
                    label="Талоны"
                    value={breakdownOverrides.voucherLiters ?? formatNumber(reportCalculator.autoVoucherLiters, 2)}
                    placeholder={formatNumber(reportCalculator.autoVoucherLiters, 2)}
                    onChange={value => setBreakdownOverride('voucherLiters', value)}
                    disabled={!isReportEditing}
                  />
                  <CalcInputRow
                    label="Товарная карта"
                    value={breakdownOverrides.cardLiters ?? formatNumber(reportCalculator.autoCardLiters, 2)}
                    placeholder={formatNumber(reportCalculator.autoCardLiters, 2)}
                    onChange={value => setBreakdownOverride('cardLiters', value)}
                    disabled={!isReportEditing}
                  />
                  <CalcInputRow
                    label="Дисконтная карта"
                    value={breakdownOverrides.discountLiters ?? formatNumber(reportCalculator.autoDiscountLiters, 2)}
                    placeholder={formatNumber(reportCalculator.autoDiscountLiters, 2)}
                    onChange={value => setBreakdownOverride('discountLiters', value)}
                    disabled={!isReportEditing}
                  />
                  <CalcRow label={`По ${reportCalculator.regularPriceLabel}`} value={`${formatLiters(reportCalculator.regularLiters)} = ${formatCurrency(reportCalculator.regularAmount)}`} strong />
                  <CalcRow label={`По ${reportCalculator.discountPriceLabel}`} value={`${formatLiters(reportCalculator.discountLiters)} = ${formatCurrency(reportCalculator.discountAmount)}`} strong />
                </div>
              </div>

              <div className="border border-blue-200 rounded-lg overflow-hidden bg-blue-50/30">
                <div className="px-4 py-2.5 bg-blue-50 border-b border-blue-200 text-blue-900" style={{ fontSize: '13px', fontWeight: 700 }}>Касса</div>
                <div className="p-4 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <div className={calcLabel} style={{ fontSize: '10px', fontWeight: 700 }}>Сумма 112/107</div>
                      <div className={calcValue} style={{ fontSize: '14px', fontWeight: 700 }}>{formatCurrency(reportCalculator.totalRevenue)}</div>
                    </div>
                    <div>
                      <div className={calcLabel} style={{ fontSize: '10px', fontWeight: 700 }}>Kaspi перевод</div>
                      <div className={calcValue} style={{ fontSize: '14px', fontWeight: 700 }}>{formatCurrency(reportCalculator.kaspiTransfer)}</div>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="reportKaspiQr" className="text-slate-600" style={{ fontSize: '12px' }}>Kaspi QR, ₸</Label>
                    <Input
                      id="reportKaspiQr"
                      inputMode="decimal"
                      value={kaspiQrInput}
                      onChange={event => setDraftKaspiQr(event.target.value)}
                      placeholder={formatNumber(reportCalculator.autoKaspiQR, 2)}
                      disabled={!isReportEditing}
                      className="h-8 bg-white border-[#d1d9e6] font-mono text-right"
                      style={{ fontSize: '13px' }}
                    />
                    <div className="text-slate-500" style={{ fontSize: '11px' }}>Пусто = автоматически {formatCurrency(reportCalculator.autoKaspiQR)}</div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="serviceMemo" className="text-slate-600" style={{ fontSize: '12px' }}>Служебная записка, ₸</Label>
                    <Input
                      id="serviceMemo"
                      inputMode="decimal"
                      value={serviceMemoInput}
                      onChange={event => setDraftServiceMemo(event.target.value)}
                      placeholder="0.00"
                      disabled={!isReportEditing}
                      className="h-8 bg-white border-[#d1d9e6] font-mono text-right"
                      style={{ fontSize: '13px' }}
                    />
                  </div>

                  <div className="pt-3 border-t border-blue-200">
                    <div className="text-blue-800 uppercase tracking-[0.05em]" style={{ fontSize: '10px', fontWeight: 700 }}>К внесению в кассу</div>
                    <div className="font-mono text-blue-950 mt-1" style={{ fontSize: '20px', fontWeight: 800 }}>{formatCurrency(reportCalculator.cashToDeposit)}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-start gap-2 px-4 py-3 bg-amber-50 border border-amber-200 rounded-lg" style={{ fontSize: '12px' }}>
        <span className="text-amber-600 shrink-0 mt-0.5">ℹ</span>
        <span className="text-amber-800">
          <strong>Примечание:</strong> ЗП — сумма ставок по типам смен, бонус — сумма ступенчатых
          бонусов за объём по каждой смене. Ставки и таблицу бонусов задаёт владелец в разделе
          «Настройки». Это сумма до удержаний (ИПН/ОПВ/ВОСМС не считаются). Долг по кассе
          показан справочно на конец выбранного месяца и автоматически из зарплаты не списывается.
          {!isSingle && ' Нажмите на строку оператора, чтобы открыть детализацию по сменам.'}
        </span>
      </div>
    </div>
  );
}

function SummaryCard({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`rounded-lg border p-3 ${accent ? 'bg-blue-50 border-blue-200' : 'bg-white border-[#d1d9e6]'}`}>
      <div className="text-slate-500" style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' }}>{label}</div>
      <div className={`mt-1 font-mono ${accent ? 'text-blue-900' : 'text-slate-900'}`} style={{ fontSize: '16px', fontWeight: 700 }}>{value}</div>
    </div>
  );
}

function CalcRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="px-4 py-2.5 flex items-center justify-between gap-4">
      <div className="text-slate-600" style={{ fontSize: '13px', fontWeight: strong ? 600 : 400 }}>{label}</div>
      <div className={`font-mono text-right ${strong ? 'text-slate-950' : 'text-slate-700'}`} style={{ fontSize: '13px', fontWeight: strong ? 700 : 500 }}>{value}</div>
    </div>
  );
}

function CalcInputRow({
  label,
  value,
  placeholder,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="px-4 py-2.5 flex items-center justify-between gap-4">
      <div className="text-slate-600" style={{ fontSize: '13px' }}>{label}</div>
      <Input
        inputMode="decimal"
        value={value}
        onChange={event => onChange(event.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className="h-8 w-36 bg-white border-[#d1d9e6] font-mono text-right"
        style={{ fontSize: '13px' }}
      />
    </div>
  );
}
