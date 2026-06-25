import { useState, useMemo, useEffect } from 'react';
import {
  ResponsiveContainer, BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { getShifts, getOperators } from '../lib/storage';
import { formatNumber } from '../lib/calculations';
import { Operator, Shift, ShiftType, SHIFT_TYPE_LABELS } from '../types';

const SHIFT_TYPE_COLORS: Record<ShiftType, string> = {
  full: '#2563eb',
  day: '#f59e0b',
  night: '#6366f1',
};

export function Dashboard() {
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

  const selectedMonthLabel = monthOptions.find(opt => opt.value === selectedMonth)?.label || '';

  // Смены выбранного месяца.
  const monthShifts = useMemo(
    () => shifts.filter(s => s.startDate.substring(0, 7) === selectedMonth),
    [shifts, selectedMonth]
  );

  // KPI за выбранный месяц.
  const kpi = useMemo(() => {
    const count = monthShifts.length;
    const liters = monthShifts.reduce((s, x) => s + x.totalLiters, 0);
    const payroll = monthShifts.reduce((s, x) => s + (x.baseSalary ?? 0) + (x.bonus ?? 0), 0);
    return {
      count,
      liters,
      payroll,
      avgLiters: count ? liters / count : 0,
    };
  }, [monthShifts]);

  // Продажи по дням месяца (литры по числам).
  const byDay = useMemo(() => {
    const [year, month] = selectedMonth.split('-').map(Number);
    const daysInMonth = new Date(year, month, 0).getDate();
    const map = new Map<number, number>();
    for (const s of monthShifts) {
      const day = Number(s.startDate.substring(8, 10));
      map.set(day, (map.get(day) ?? 0) + s.totalLiters);
    }
    return Array.from({ length: daysInMonth }, (_, i) => ({
      day: i + 1,
      liters: Math.round(map.get(i + 1) ?? 0),
    }));
  }, [monthShifts, selectedMonth]);

  // Динамика за 12 месяцев (реализация + фонд ЗП), независимо от фильтра.
  const byMonth = useMemo(() => {
    return monthOptions
      .slice()
      .reverse()
      .map(opt => {
        const ms = shifts.filter(s => s.startDate.substring(0, 7) === opt.value);
        return {
          month: opt.value.substring(5) + '.' + opt.value.substring(2, 4),
          liters: Math.round(ms.reduce((s, x) => s + x.totalLiters, 0)),
          payroll: Math.round(ms.reduce((s, x) => s + (x.baseSalary ?? 0) + (x.bonus ?? 0), 0)),
        };
      });
  }, [shifts, monthOptions]);

  // Разрез по типу смены (литры + кол-во) за выбранный месяц.
  const byType = useMemo(() => {
    return (['full', 'day', 'night'] as ShiftType[])
      .map(type => {
        const ms = monthShifts.filter(s => s.shiftType === type);
        return {
          type,
          name: SHIFT_TYPE_LABELS[type],
          liters: Math.round(ms.reduce((s, x) => s + x.totalLiters, 0)),
          count: ms.length,
        };
      })
      .filter(x => x.count > 0);
  }, [monthShifts]);

  // Топ операторов по реализации за месяц.
  const topOperators = useMemo(() => {
    const nameById = new Map(operators.map(op => [op.id, op.name]));
    const map = new Map<string, number>();
    for (const s of monthShifts) {
      map.set(s.operatorId, (map.get(s.operatorId) ?? 0) + s.totalLiters);
    }
    return Array.from(map.entries())
      .map(([id, liters]) => ({ name: nameById.get(id) ?? '—', liters: Math.round(liters) }))
      .sort((a, b) => b.liters - a.liters)
      .slice(0, 8);
  }, [monthShifts, operators]);

  const hasData = monthShifts.length > 0;
  const fmtL = (v: number) => `${formatNumber(v, 0)} л`;
  const fmtMoney = (v: number) => `${formatNumber(v, 0)} ₸`;

  return (
    <div className="space-y-4">
      {error && (
        <div className="px-4 py-2.5 bg-red-50 border border-red-200 rounded-lg text-red-700" style={{ fontSize: '13px' }}>
          {error}
        </div>
      )}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-slate-900" style={{ fontSize: '18px', fontWeight: 600 }}>Дашборд</h1>
          <p className="text-slate-500 mt-0.5" style={{ fontSize: '12px' }}>Продажи и смены за {selectedMonthLabel}</p>
        </div>
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
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="Смен" value={String(kpi.count)} />
        <KpiCard label="Реализация" value={fmtL(kpi.liters)} />
        <KpiCard label="Фонд ЗП" value={fmtMoney(kpi.payroll)} accent />
        <KpiCard label="Средняя на смену" value={fmtL(Math.round(kpi.avgLiters))} />
      </div>

      {!hasData ? (
        <div className="bg-white border border-[#d1d9e6] rounded-lg p-12 text-center">
          <p className="text-slate-400" style={{ fontSize: '14px' }}>Нет данных за {selectedMonthLabel}</p>
        </div>
      ) : (
        <>
          <ChartCard title="Продажи по дням месяца" subtitle="Реализация (л) по числам">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={byDay} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#edf0f5" vertical={false} />
                <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={{ stroke: '#d1d9e6' }} tickLine={false} interval={0} minTickGap={0} />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} width={48} tickFormatter={(v) => formatNumber(v, 0)} />
                <Tooltip formatter={(v: number) => [fmtL(v), 'Реализация']} labelFormatter={(d) => `День ${d}`} contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #d1d9e6' }} />
                <Bar dataKey="liters" fill="#2563eb" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Динамика по месяцам" subtitle="Реализация и фонд ЗП за 12 месяцев">
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={byMonth} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#edf0f5" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={{ stroke: '#d1d9e6' }} tickLine={false} />
                <YAxis yAxisId="left" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} width={52} tickFormatter={(v) => formatNumber(v, 0)} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} width={56} tickFormatter={(v) => formatNumber(v, 0)} />
                <Tooltip formatter={(v: number, name) => [name === 'Реализация (л)' ? fmtL(v) : fmtMoney(v), name]} contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #d1d9e6' }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line yAxisId="left" type="monotone" dataKey="liters" name="Реализация (л)" stroke="#2563eb" strokeWidth={2} dot={{ r: 2 }} />
                <Line yAxisId="right" type="monotone" dataKey="payroll" name="Фонд ЗП (₸)" stroke="#f59e0b" strokeWidth={2} dot={{ r: 2 }} />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <ChartCard title="Разрез по типу смены" subtitle="Доля реализации: сутки / день / ночь">
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie data={byType} dataKey="liters" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={(e: { name: string; count: number }) => `${e.name} (${e.count})`} labelLine={false} style={{ fontSize: 12 }}>
                    {byType.map(entry => (
                      <Cell key={entry.type} fill={SHIFT_TYPE_COLORS[entry.type]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number, _n, p) => [fmtL(v), `${p.payload.name} · ${p.payload.count} смен`]} contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #d1d9e6' }} />
                </PieChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Топ операторов" subtitle="Реализация (л) за месяц">
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={topOperators} layout="vertical" margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#edf0f5" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} tickFormatter={(v) => formatNumber(v, 0)} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#334155' }} axisLine={false} tickLine={false} width={120} />
                  <Tooltip formatter={(v: number) => [fmtL(v), 'Реализация']} contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #d1d9e6' }} />
                  <Bar dataKey="liters" fill="#2563eb" radius={[0, 3, 3, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>
        </>
      )}
    </div>
  );
}

function KpiCard({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`rounded-lg border p-3.5 ${accent ? 'bg-blue-50 border-blue-200' : 'bg-white border-[#d1d9e6]'}`}>
      <div className="text-slate-500" style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' }}>{label}</div>
      <div className={`mt-1.5 font-mono ${accent ? 'text-blue-900' : 'text-slate-900'}`} style={{ fontSize: '18px', fontWeight: 700 }}>{value}</div>
    </div>
  );
}

function ChartCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-[#d1d9e6] rounded-lg p-4">
      <div className="mb-3">
        <h2 className="text-slate-900" style={{ fontSize: '14px', fontWeight: 600 }}>{title}</h2>
        {subtitle && <p className="text-slate-500 mt-0.5" style={{ fontSize: '12px' }}>{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}
