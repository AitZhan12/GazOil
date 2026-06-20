import { useState, useMemo, useEffect } from 'react';
import { Download } from 'lucide-react';
import { Button } from './ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { getShifts, getOperators } from '../lib/storage';
import { formatCurrency, formatLiters } from '../lib/calculations';
import { MonthlyOperatorStats, Operator, Shift } from '../types';

export function MonthlyReport() {
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

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
  
  // Calculate stats per operator
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
  
  const handleExport = () => {
    // Create CSV content
    const headers = [
      'Оператор',
      'Смен',
      'Литров продано',
      'Талонов (л)',
      'Выручка (₸)',
      'ЗП база (₸)',
      'Бонус (₸)',
      'Итого к выплате (₸)',
    ];
    
    const rows = operatorStats.map(stat => [
      stat.operatorName,
      stat.shiftsCount,
      stat.totalLiters.toFixed(2),
      stat.voucherLiters.toFixed(2),
      stat.totalRevenue.toFixed(0),
      stat.baseSalary.toFixed(0),
      stat.bonus.toFixed(0),
      stat.totalPayout.toFixed(0),
    ]);
    
    rows.push([
      'ИТОГО',
      totals.shiftsCount,
      totals.totalLiters.toFixed(2),
      totals.voucherLiters.toFixed(2),
      totals.totalRevenue.toFixed(0),
      totals.baseSalary.toFixed(0),
      totals.bonus.toFixed(0),
      totals.totalPayout.toFixed(0),
    ]);
    
    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    const monthLabel = monthOptions.find(opt => opt.value === selectedMonth)?.label || selectedMonth;
    link.setAttribute('href', url);
    link.setAttribute('download', `Отчёт_${monthLabel}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  
  const selectedMonthLabel = monthOptions.find(opt => opt.value === selectedMonth)?.label || '';
  
  const thCell = 'px-4 py-2.5 text-slate-500 border-r border-[#edf0f5] last:border-r-0';
  const thStyle = { fontSize: '11px', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' as const };

  return (
    <div className="space-y-4">
      {error && (
        <div className="px-4 py-2.5 bg-red-50 border border-red-200 rounded-lg text-red-700" style={{ fontSize: '13px' }}>
          {error}
        </div>
      )}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-slate-900" style={{ fontSize: '18px', fontWeight: 600 }}>Месячный отчёт</h1>
          <p className="text-slate-500 mt-0.5" style={{ fontSize: '12px' }}>Итоги по операторам за период</p>
        </div>
        <div className="flex items-center gap-3">
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
          <Button onClick={handleExport} className="gap-1.5 bg-blue-600 hover:bg-blue-700 text-white h-8 px-3" style={{ fontSize: '13px' }}>
            <Download className="size-3.5" />
            CSV
          </Button>
        </div>
      </div>

      {operatorStats.length === 0 || totals.shiftsCount === 0 ? (
        <div className="bg-white border border-[#d1d9e6] rounded-lg p-12 text-center">
          <p className="text-slate-400" style={{ fontSize: '14px' }}>Нет данных за {selectedMonthLabel}</p>
        </div>
      ) : (
        <div className="bg-white border border-[#d1d9e6] rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse min-w-[760px]">
              <thead>
                <tr className="bg-[#f8fafc] border-b border-[#d1d9e6]">
                  <th className={`${thCell} text-left`} style={thStyle}>Оператор</th>
                  <th className={`${thCell} text-right`} style={thStyle}>Смен</th>
                  <th className={`${thCell} text-right`} style={thStyle}>Реализ. (л)</th>
                  <th className={`${thCell} text-right`} style={thStyle}>Талоны (л)</th>
                  <th className={`${thCell} text-right`} style={thStyle}>Выручка</th>
                  <th className={`${thCell} text-right bg-blue-50`} style={thStyle}>ЗП база</th>
                  <th className={`${thCell} text-right bg-blue-50`} style={thStyle}>Бонус</th>
                  <th className={`${thCell} text-right bg-blue-50`} style={thStyle}>К выплате</th>
                </tr>
              </thead>
              <tbody>
                {operatorStats.map((stat, idx) => (
                  <tr key={stat.operatorId} className={`border-b border-[#edf0f5] hover:bg-[#f8fafc] transition-colors ${idx === operatorStats.length - 1 ? 'border-b-0' : ''}`}>
                    <td className="px-4 py-2.5 text-slate-900 border-r border-[#edf0f5]" style={{ fontSize: '13px' }}>{stat.operatorName}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-slate-700 border-r border-[#edf0f5]" style={{ fontSize: '13px' }}>{stat.shiftsCount}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-slate-700 border-r border-[#edf0f5]" style={{ fontSize: '13px' }}>{formatLiters(stat.totalLiters)}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-slate-700 border-r border-[#edf0f5]" style={{ fontSize: '13px' }}>{formatLiters(stat.voucherLiters)}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-slate-900 border-r border-[#edf0f5]" style={{ fontSize: '13px', fontWeight: 500 }}>{formatCurrency(stat.totalRevenue)}</td>
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
                  <td className="px-4 py-2.5 text-right font-mono text-slate-900 border-r border-[#edf0f5]" style={{ fontSize: '13px', fontWeight: 600 }}>{formatCurrency(totals.totalRevenue)}</td>
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
        </span>
      </div>
    </div>
  );
}
