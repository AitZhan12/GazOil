import { useState, useMemo, useEffect } from 'react';
import { Download } from 'lucide-react';
import { Button } from './ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { getShifts, getOperators } from '../lib/storage';
import { formatCurrency, formatLiters } from '../lib/calculations';
import { MonthlyOperatorStats, Operator, Shift, SHIFT_TYPE_LABELS } from '../types';

const ALL = 'all';

export function MonthlyReport() {
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [selectedOperator, setSelectedOperator] = useState<string>(ALL);

  const [operators, setOperators] = useState<Operator[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [error, setError] = useState('');

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
        };
      });

    return stats;
  }, [operators, shifts, selectedMonth]);

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
      }),
      {
        shiftsCount: 0,
        totalLiters: 0,
        voucherLiters: 0,
        totalRevenue: 0,
        baseSalary: 0,
        bonus: 0,
        totalPayout: 0,
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

  const formatDate = (iso: string) => {
    const [y, m, d] = iso.split('-');
    return d && m && y ? `${d}.${m}.${y}` : iso;
  };

  const downloadCsv = (rows: (string | number)[][], filename: string) => {
    const csv = rows.map(row => row.join(',')).join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
      ]);
      downloadCsv([headers, ...rows], `Расчёт_${selectedOperatorName}_${selectedMonthLabel}.csv`);
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
    ];
    const rows = operatorStats.map(stat => [
      stat.operatorName,
      stat.shiftsCount,
      stat.totalLiters.toFixed(2),
      stat.voucherLiters.toFixed(2),
      stat.baseSalary.toFixed(0),
      stat.bonus.toFixed(0),
      stat.totalPayout.toFixed(0),
    ]);
    rows.push([
      'ИТОГО',
      totals.shiftsCount,
      totals.totalLiters.toFixed(2),
      totals.voucherLiters.toFixed(2),
      totals.baseSalary.toFixed(0),
      totals.bonus.toFixed(0),
      totals.totalPayout.toFixed(0),
    ]);
    downloadCsv([headers, ...rows], `Зарплатный_акт_${selectedMonthLabel}.csv`);
  };

  const isSingle = selectedOperator !== ALL;
  const hasData = isSingle ? operatorShifts.length > 0 : totals.shiftsCount > 0;

  const thCell = 'px-4 py-2.5 text-slate-500 border-r border-[#edf0f5] last:border-r-0';
  const thStyle = { fontSize: '11px', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' as const };
  const tdNum = 'px-4 py-2.5 text-right font-mono text-slate-700 border-r border-[#edf0f5]';

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
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
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
            CSV
          </Button>
        </div>
      </div>

      {/* Карточки-итоги по выбранному оператору */}
      {isSingle && hasData && selectedStat && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <SummaryCard label="Смен" value={String(selectedStat.shiftsCount)} />
          <SummaryCard label="Реализация" value={`${formatLiters(selectedStat.totalLiters)} л`} />
          <SummaryCard label="ЗП база" value={formatCurrency(selectedStat.baseSalary)} />
          <SummaryCard label="Бонус" value={formatCurrency(selectedStat.bonus)} />
          <SummaryCard label="К выплате" value={formatCurrency(selectedStat.totalPayout)} accent />
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
            <table className="w-full border-collapse min-w-[760px]">
              <thead>
                <tr className="bg-[#f8fafc] border-b border-[#d1d9e6]">
                  <th className={`${thCell} text-left`} style={thStyle}>Оператор</th>
                  <th className={`${thCell} text-right`} style={thStyle}>Смен</th>
                  <th className={`${thCell} text-right`} style={thStyle}>Реализ. (л)</th>
                  <th className={`${thCell} text-right`} style={thStyle}>Талоны (л)</th>
                  <th className={`${thCell} text-right bg-blue-50`} style={thStyle}>ЗП база</th>
                  <th className={`${thCell} text-right bg-blue-50`} style={thStyle}>Бонус</th>
                  <th className={`${thCell} text-right bg-blue-50`} style={thStyle}>К выплате</th>
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
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      <div className="flex items-start gap-2 px-4 py-3 bg-amber-50 border border-amber-200 rounded-lg" style={{ fontSize: '12px' }}>
        <span className="text-amber-600 shrink-0 mt-0.5">ℹ</span>
        <span className="text-amber-800">
          <strong>Примечание:</strong> ЗП — сумма ставок по типам смен, бонус — сумма ступенчатых
          бонусов за объём по каждой смене. Ставки и таблицу бонусов задаёт владелец в разделе
          «Настройки». Это сумма до удержаний (ИПН/ОПВ/ВОСМС не считаются).
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
