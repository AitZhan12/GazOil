import { useState, useMemo, useEffect } from 'react';
import { Link } from 'react-router';
import { Plus, Pencil, Trash2, Layers, AlertTriangle } from 'lucide-react';
import { Button } from './ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { getShifts, getOperators, deleteShift } from '../lib/storage';
import { formatCurrency, formatLiters } from '../lib/calculations';
import { Operator, Shift, SHIFT_TYPE_LABELS } from '../types';

export function ShiftJournal() {
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [selectedOperator, setSelectedOperator] = useState<string>('all');

  const [operators, setOperators] = useState<Operator[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    Promise.all([getOperators(), getShifts()])
      .then(([ops, shs]) => {
        if (cancelled) return;
        setOperators(ops);
        setShifts(shs);
      })
      .catch(e => { if (!cancelled) setError(e instanceof Error ? e.message : 'Ошибка загрузки'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

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

  const filteredShifts = useMemo(() => {
    return shifts.filter(shift => {
      const shiftMonth = shift.startDate.substring(0, 7);
      const matchesMonth = shiftMonth === selectedMonth;
      const matchesOperator = selectedOperator === 'all' || shift.operatorId === selectedOperator;
      return matchesMonth && matchesOperator;
    }).sort((a, b) => {
      return `${a.startDate} ${a.startTime}`.localeCompare(`${b.startDate} ${b.startTime}`);
    });
  }, [shifts, selectedMonth, selectedOperator]);

  // Id смен, участвующих хотя бы в одном пересечении по времени — те же правила,
  // что и в форме (касание встык тоже считаем пересечением). Для отметки в строке.
  const overlapIds = useMemo(() => {
    const ms = (d: string, t: string) => new Date(`${d}T${t}`).getTime();
    const ids = new Set<string>();
    for (let i = 0; i < filteredShifts.length; i++) {
      for (let j = i + 1; j < filteredShifts.length; j++) {
        const a = filteredShifts[i], b = filteredShifts[j];
        const as = ms(a.startDate, a.startTime), ae = ms(a.endDate, a.endTime);
        const bs = ms(b.startDate, b.startTime), be = ms(b.endDate, b.endTime);
        if (!(ae > as) || !(be > bs)) continue;
        if (as <= be && bs <= ae) { ids.add(a.id); ids.add(b.id); }
      }
    }
    return ids;
  }, [filteredShifts]);

  const handleDelete = async (id: string) => {
    if (!confirm('Удалить смену?')) return;
    try {
      await deleteShift(id);
      setShifts(prev => prev.filter(s => s.id !== id));
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Не удалось удалить смену');
    }
  };

  const getOperatorName = (id: string) => {
    return operators.find(op => op.id === id)?.name || 'Неизвестно';
  };

  // Totals for footer
  const totalLiters = filteredShifts.reduce((s, sh) => s + sh.totalLiters, 0);
  const totalRevenue = filteredShifts.reduce((s, sh) => s + sh.totalRevenue, 0);
  const totalCash = filteredShifts.reduce((s, sh) => s + sh.totalCash, 0);

  return (
    <div className="space-y-4">
      {error && (
        <div className="px-4 py-2.5 bg-red-50 border border-red-200 rounded-lg text-red-700" style={{ fontSize: '13px' }}>
          {error}
        </div>
      )}
      {loading && !error && (
        <div className="px-4 py-2.5 text-slate-500" style={{ fontSize: '13px' }}>Загрузка…</div>
      )}
      {/* Page header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-slate-900" style={{ fontSize: '18px', fontWeight: 600 }}>Журнал смен</h1>
          <p className="text-slate-500 mt-0.5" style={{ fontSize: '12px' }}>
            {filteredShifts.length} смен{filteredShifts.length === 1 ? 'а' : filteredShifts.length < 5 ? 'ы' : ''} за период
          </p>
        </div>
        <Link to="/shift/new">
          <Button className="gap-1.5 bg-blue-600 hover:bg-blue-700 text-white h-8 px-3" style={{ fontSize: '13px' }}>
            <Plus className="size-3.5" />
            Новая смена
          </Button>
        </Link>
      </div>

      {/* Filters bar */}
      <div className="bg-white border border-[#d1d9e6] rounded-lg px-4 py-3 flex items-center gap-3 sm:gap-4 flex-wrap">
        <span className="text-slate-500 shrink-0" style={{ fontSize: '12px' }}>Фильтр:</span>
        <div className="flex items-center gap-3 flex-wrap w-full sm:w-auto">
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="h-8 w-full sm:w-52 border-[#d1d9e6] bg-[#f8fafc]" style={{ fontSize: '13px' }}>
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

          <Select value={selectedOperator} onValueChange={setSelectedOperator}>
            <SelectTrigger className="h-8 w-full sm:w-56 border-[#d1d9e6] bg-[#f8fafc]" style={{ fontSize: '13px' }}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" style={{ fontSize: '13px' }}>Все операторы</SelectItem>
              {operators.filter(op => op.active).map(op => (
                <SelectItem key={op.id} value={op.id} style={{ fontSize: '13px' }}>
                  {op.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Table */}
      {filteredShifts.length === 0 ? (
        <div className="bg-white border border-[#d1d9e6] rounded-lg p-16 text-center">
          <Layers className="size-10 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500" style={{ fontSize: '14px' }}>Нет смен за выбранный период</p>
          <Link to="/shift/new">
            <Button className="mt-4 gap-1.5 bg-blue-600 hover:bg-blue-700 text-white h-8 px-3" style={{ fontSize: '13px' }}>
              <Plus className="size-3.5" />
              Добавить первую смену
            </Button>
          </Link>
        </div>
      ) : (
        <div className="bg-white border border-[#d1d9e6] rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full border-collapse min-w-[640px]">
            <thead>
              <tr className="bg-[#f8fafc] border-b border-[#d1d9e6]">
                <th className="px-4 py-2.5 text-left text-slate-500 border-r border-[#edf0f5]" style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                  Дата / Время
                </th>
                <th className="px-4 py-2.5 text-left text-slate-500 border-r border-[#edf0f5]" style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                  Оператор
                </th>
                <th className="px-4 py-2.5 text-right text-slate-500 border-r border-[#edf0f5]" style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                  Реализация (л)
                </th>
                <th className="px-4 py-2.5 text-right text-slate-500 border-r border-[#edf0f5]" style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                  Выручка (₸)
                </th>
                <th className="px-4 py-2.5 text-right text-slate-500 border-r border-[#edf0f5]" style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                  Наличными (₸)
                </th>
                <th className="px-4 py-2.5 text-right text-slate-500" style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                  &nbsp;
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredShifts.map((shift, idx) => (
                <tr
                  key={shift.id}
                  className={`
                    border-b border-[#edf0f5] hover:bg-[#f8fafc] transition-colors
                    ${idx === filteredShifts.length - 1 ? 'border-b-0' : ''}
                  `}
                >
                  <td className="px-4 py-2.5 border-r border-[#edf0f5]">
                    <span className="font-mono text-slate-900" style={{ fontSize: '13px' }}>
                      {new Date(shift.startDate).toLocaleDateString('ru-RU')}
                    </span>
                    <span className="text-slate-400 ml-2 font-mono" style={{ fontSize: '12px' }}>
                      {shift.startTime}–{shift.endTime}
                    </span>
                    {shift.shiftType && (
                      <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded bg-slate-100 text-slate-600" style={{ fontSize: '10px', fontWeight: 600 }}>
                        {SHIFT_TYPE_LABELS[shift.shiftType]}
                      </span>
                    )}
                    {overlapIds.has(shift.id) && (
                      <span
                        className="ml-2 inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-red-50 text-red-700 border border-red-200 align-middle"
                        style={{ fontSize: '10px', fontWeight: 600 }}
                        title="Пересечение по времени с другой сменой"
                      >
                        <AlertTriangle className="size-3" />
                        Пересечение
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-slate-700 border-r border-[#edf0f5]" style={{ fontSize: '13px' }}>
                    {getOperatorName(shift.operatorId)}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-slate-900 border-r border-[#edf0f5]" style={{ fontSize: '13px' }}>
                    {formatLiters(shift.totalLiters)}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-slate-900 border-r border-[#edf0f5]" style={{ fontSize: '13px', fontWeight: 500 }}>
                    {formatCurrency(shift.totalRevenue)}
                  </td>
                  <td className={`px-4 py-2.5 text-right font-mono border-r border-[#edf0f5] ${shift.totalCash < 0 ? 'text-red-600' : 'text-slate-900'}`} style={{ fontSize: '13px' }}>
                    {formatCurrency(shift.totalCash)}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Link to={`/shift/${shift.id}`}>
                        <Button variant="ghost" size="sm" className="h-7 px-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50" style={{ fontSize: '12px' }}>
                          <Pencil className="size-3 mr-1" />
                          Открыть
                        </Button>
                      </Link>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(shift.id)}
                        className="h-7 w-7 p-0 text-slate-400 hover:text-red-600 hover:bg-red-50"
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            {/* Summary footer */}
            <tfoot>
              <tr className="bg-[#f0f2f5] border-t-2 border-[#d1d9e6]">
                <td className="px-4 py-2.5 border-r border-[#edf0f5] text-slate-500" style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase' }}>
                  Итого за период
                </td>
                <td className="px-4 py-2.5 border-r border-[#edf0f5] text-slate-500" style={{ fontSize: '12px' }}>
                  {filteredShifts.length} смен
                </td>
                <td className="px-4 py-2.5 text-right font-mono border-r border-[#edf0f5] text-slate-900" style={{ fontSize: '13px', fontWeight: 600 }}>
                  {formatLiters(totalLiters)}
                </td>
                <td className="px-4 py-2.5 text-right font-mono border-r border-[#edf0f5] text-slate-900" style={{ fontSize: '13px', fontWeight: 600 }}>
                  {formatCurrency(totalRevenue)}
                </td>
                <td className="px-4 py-2.5 text-right font-mono border-r border-[#edf0f5] text-slate-900" style={{ fontSize: '13px', fontWeight: 600 }}>
                  {formatCurrency(totalCash)}
                </td>
                <td className="px-4 py-2.5" />
              </tr>
            </tfoot>
          </table>
          </div>
        </div>
      )}
    </div>
  );
}
