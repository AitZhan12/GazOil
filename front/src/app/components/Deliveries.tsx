import { useState, useEffect, useMemo } from 'react';
import { Plus, Pencil, Trash2, AlertTriangle, Fuel, Droplet } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import { getDeliveries, addDelivery, updateDelivery, deleteDelivery, getShifts, getSettings } from '../lib/storage';
import { formatLiters, formatNumber } from '../lib/calculations';
import { buildInventoryTimeline } from '../lib/inventory';
import { AppSettings, GasDelivery, Shift } from '../types';

// Дата ДД.ММ.ГГГГ ↔ ISO, время ЧЧ:ММ — те же маски, что и в форме смены.
function isoToRu(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : '';
}
function maskRuDate(input: string): string {
  const d = input.replace(/\D/g, '').slice(0, 8);
  let out = d.slice(0, 2);
  if (d.length > 2) out += '.' + d.slice(2, 4);
  if (d.length > 4) out += '.' + d.slice(4, 8);
  return out;
}
function ruToIso(ru: string): string {
  const m = ru.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (!m) return '';
  const [, dd, mm, yyyy] = m;
  if (+mm < 1 || +mm > 12 || +dd < 1 || +dd > 31) return '';
  return `${yyyy}-${mm}-${dd}`;
}
function maskTime(input: string): string {
  const d = input.replace(/\D/g, '').slice(0, 4);
  let out = d.slice(0, 2);
  if (d.length > 2) out += ':' + d.slice(2, 4);
  return out;
}
function isValidTime(t: string): boolean {
  const m = t.match(/^(\d{2}):(\d{2})$/);
  return !!m && +m[1] < 24 && +m[2] < 60;
}

export function Deliveries() {
  const [deliveries, setDeliveries] = useState<GasDelivery[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editing, setEditing] = useState<GasDelivery | null>(null);
  const [saving, setSaving] = useState(false);

  // Поля формы прихода.
  const [dateText, setDateText] = useState('');
  const [time, setTime] = useState('');
  const [liters, setLiters] = useState('');
  const [supplier, setSupplier] = useState('');
  const [note, setNote] = useState('');

  useEffect(() => {
    let cancelled = false;
    Promise.all([getDeliveries(), getShifts(), getSettings()])
      .then(([ds, shs, s]) => {
        if (cancelled) return;
        setDeliveries(ds);
        setShifts(shs);
        setSettings(s);
      })
      .catch(e => { if (!cancelled) setError(e instanceof Error ? e.message : 'Ошибка загрузки'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const timeline = useMemo(
    () => buildInventoryTimeline(
      settings?.initialStockLiters ?? 0,
      settings?.tankCapacityLiters ?? 0,
      deliveries,
      shifts,
    ),
    [settings, deliveries, shifts],
  );

  // Остаток после каждого прихода — из ленты движения (по refId поставки).
  const balanceAfterDelivery = useMemo(() => {
    const map = new Map<string, number>();
    timeline.events.forEach(e => { if (e.kind === 'delivery') map.set(e.refId, e.balanceAfter); });
    return map;
  }, [timeline]);

  // Поставки по убыванию даты (свежие сверху).
  const sortedDeliveries = useMemo(
    () => [...deliveries].sort((a, b) =>
      `${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`)),
    [deliveries],
  );

  const capacity = settings?.tankCapacityLiters ?? 0;
  const fillPct = capacity > 0 ? Math.max(0, Math.min(100, (timeline.currentBalance / capacity) * 100)) : 0;
  const lowBalance = timeline.currentBalance < 0;

  const openDialog = (d?: GasDelivery) => {
    if (d) {
      setEditing(d);
      setDateText(isoToRu(d.date));
      setTime(d.time);
      setLiters(String(d.liters));
      setSupplier(d.supplier ?? '');
      setNote(d.note ?? '');
    } else {
      setEditing(null);
      const today = new Date().toISOString().split('T')[0];
      setDateText(isoToRu(today));
      setTime('');
      setLiters('');
      setSupplier('');
      setNote('');
    }
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    const isoDate = ruToIso(dateText);
    if (!isoDate) { alert('Укажите дату в формате ДД.ММ.ГГГГ'); return; }
    if (time && !isValidTime(time)) { alert('Время в формате ЧЧ:ММ'); return; }
    const litersNum = parseFloat(liters) || 0;
    if (litersNum <= 0) { alert('Объём прихода должен быть больше нуля'); return; }

    const payload = {
      date: isoDate,
      time: time || '00:00',
      liters: litersNum,
      supplier: supplier.trim() || undefined,
      note: note.trim() || undefined,
    };

    setSaving(true);
    try {
      if (editing) {
        const updated = await updateDelivery(editing.id, { ...editing, ...payload });
        setDeliveries(prev => prev.map(d => (d.id === updated.id ? updated : d)));
      } else {
        const created = await addDelivery(payload);
        setDeliveries(prev => [...prev, created]);
      }
      setIsDialogOpen(false);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Не удалось сохранить приход');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Удалить запись о приходе?')) return;
    try {
      await deleteDelivery(id);
      setDeliveries(prev => prev.filter(d => d.id !== id));
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Не удалось удалить приход');
    }
  };

  const totalDelivered = deliveries.reduce((s, d) => s + d.liters, 0);

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

      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-slate-900" style={{ fontSize: '18px', fontWeight: 600 }}>Приход газа</h1>
          <p className="text-slate-500 mt-0.5" style={{ fontSize: '12px' }}>
            {deliveries.length} поставок · всего {formatLiters(totalDelivered)}
          </p>
        </div>
        <Button onClick={() => openDialog()} className="gap-1.5 bg-blue-600 hover:bg-blue-700 text-white h-8 px-3" style={{ fontSize: '13px' }}>
          <Plus className="size-3.5" />
          Добавить приход
        </Button>
      </div>

      {/* Остаток в резервуаре */}
      <div className={`rounded-lg border p-4 flex items-center gap-4 flex-wrap ${lowBalance ? 'bg-red-50 border-red-200' : 'bg-white border-[#d1d9e6]'}`}>
        <div className={`size-10 rounded-lg flex items-center justify-center shrink-0 ${lowBalance ? 'bg-red-100' : 'bg-blue-50'}`}>
          <Fuel className={`size-5 ${lowBalance ? 'text-red-600' : 'text-blue-600'}`} />
        </div>
        <div className="min-w-[140px]">
          <div className="text-slate-500" style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Текущий остаток
          </div>
          <div className={`font-mono ${lowBalance ? 'text-red-700' : 'text-slate-900'}`} style={{ fontSize: '22px', fontWeight: 700 }}>
            {formatLiters(timeline.currentBalance)}
          </div>
        </div>
        {capacity > 0 && (
          <div className="flex-1 min-w-[180px]">
            <div className="flex items-center justify-between text-slate-500 mb-1" style={{ fontSize: '11px' }}>
              <span>Заполнение резервуара</span>
              <span className="font-mono">{formatNumber(fillPct, 0)}% · из {formatLiters(capacity)}</span>
            </div>
            <div className="h-2 rounded bg-slate-100 overflow-hidden">
              <div className={`h-full ${lowBalance ? 'bg-red-500' : fillPct > 95 ? 'bg-amber-500' : 'bg-blue-500'}`} style={{ width: `${fillPct}%` }} />
            </div>
          </div>
        )}
        {settings && (
          <div className="text-slate-400 shrink-0" style={{ fontSize: '11px' }}>
            Начальный: {formatLiters(settings.initialStockLiters)}
          </div>
        )}
      </div>

      {/* Предупреждения по остатку */}
      {timeline.warnings.length > 0 && (
        <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-red-700" style={{ fontSize: '12px' }}>
          <div className="flex items-center gap-2 mb-1.5" style={{ fontWeight: 600 }}>
            <AlertTriangle className="size-4 shrink-0" />
            Проблемы с остатком ({timeline.warnings.length})
          </div>
          <ul className="space-y-1 pl-6 list-disc">
            {timeline.warnings.map((w, i) => (
              <li key={i}>
                <span className="font-mono">{isoToRu(w.date)} {w.time}</span> — {w.label}:{' '}
                {w.negative
                  ? <>остаток ушёл в минус (<span className="font-mono">{formatLiters(w.balanceAfter)}</span>) — продано больше, чем было</>
                  : <>приход превысил объём резервуара (<span className="font-mono">{formatLiters(w.balanceAfter)}</span> &gt; {formatLiters(capacity)})</>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Таблица поставок */}
      {!loading && deliveries.length === 0 ? (
        <div className="bg-white border border-[#d1d9e6] rounded-lg p-16 text-center">
          <Droplet className="size-10 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500" style={{ fontSize: '14px' }}>Поставок ещё нет</p>
          <Button onClick={() => openDialog()} className="mt-4 gap-1.5 bg-blue-600 hover:bg-blue-700 text-white h-8 px-3" style={{ fontSize: '13px' }}>
            <Plus className="size-3.5" />
            Добавить первый приход
          </Button>
        </div>
      ) : deliveries.length > 0 && (
        <div className="bg-white border border-[#d1d9e6] rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full border-collapse min-w-[640px]">
            <thead>
              <tr className="bg-[#f8fafc] border-b border-[#d1d9e6]">
                <th className="px-4 py-2.5 text-left text-slate-500 border-r border-[#edf0f5]" style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Дата / Время</th>
                <th className="px-4 py-2.5 text-left text-slate-500 border-r border-[#edf0f5]" style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Поставщик</th>
                <th className="px-4 py-2.5 text-right text-slate-500 border-r border-[#edf0f5]" style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Приход (л)</th>
                <th className="px-4 py-2.5 text-right text-slate-500 border-r border-[#edf0f5]" style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Остаток после (л)</th>
                <th className="px-4 py-2.5 text-right text-slate-500" style={{ fontSize: '11px', fontWeight: 600 }}>&nbsp;</th>
              </tr>
            </thead>
            <tbody>
              {sortedDeliveries.map((d, idx) => {
                const after = balanceAfterDelivery.get(d.id);
                return (
                  <tr key={d.id} className={`border-b border-[#edf0f5] hover:bg-[#f8fafc] transition-colors ${idx === sortedDeliveries.length - 1 ? 'border-b-0' : ''}`}>
                    <td className="px-4 py-2.5 border-r border-[#edf0f5]">
                      <span className="font-mono text-slate-900" style={{ fontSize: '13px' }}>{isoToRu(d.date)}</span>
                      <span className="text-slate-400 ml-2 font-mono" style={{ fontSize: '12px' }}>{d.time}</span>
                    </td>
                    <td className="px-4 py-2.5 text-slate-700 border-r border-[#edf0f5]" style={{ fontSize: '13px' }}>
                      {d.supplier || <span className="text-slate-300">—</span>}
                      {d.note && <span className="text-slate-400 block" style={{ fontSize: '11px' }}>{d.note}</span>}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-emerald-700 border-r border-[#edf0f5]" style={{ fontSize: '13px', fontWeight: 600 }}>
                      +{formatLiters(d.liters)}
                    </td>
                    <td className={`px-4 py-2.5 text-right font-mono border-r border-[#edf0f5] ${after !== undefined && after < 0 ? 'text-red-600' : 'text-slate-900'}`} style={{ fontSize: '13px' }}>
                      {after !== undefined ? formatLiters(after) : '—'}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => openDialog(d)} className="h-7 px-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50" style={{ fontSize: '12px' }}>
                          <Pencil className="size-3 mr-1" />
                          Изменить
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDelete(d.id)} className="h-7 w-7 p-0 text-slate-400 hover:text-red-600 hover:bg-red-50">
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle style={{ fontSize: '15px', fontWeight: 600 }}>
              {editing ? 'Редактирование прихода' : 'Новый приход газа'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 py-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="d-date" className="text-slate-600" style={{ fontSize: '12px' }}>Дата</Label>
                <Input id="d-date" inputMode="numeric" placeholder="ДД.ММ.ГГГГ" value={dateText}
                  onChange={e => setDateText(maskRuDate(e.target.value))}
                  className="mt-1 h-8 font-mono border-[#d1d9e6] bg-[#f8fafc]" style={{ fontSize: '13px' }} />
              </div>
              <div>
                <Label htmlFor="d-time" className="text-slate-600" style={{ fontSize: '12px' }}>Время</Label>
                <Input id="d-time" inputMode="numeric" placeholder="ЧЧ:ММ" value={time}
                  onChange={e => setTime(maskTime(e.target.value))}
                  className="mt-1 h-8 font-mono border-[#d1d9e6] bg-[#f8fafc]" style={{ fontSize: '13px' }} />
              </div>
            </div>
            <div>
              <Label htmlFor="d-liters" className="text-slate-600" style={{ fontSize: '12px' }}>Объём прихода (л)</Label>
              <Input id="d-liters" type="number" step="0.01" placeholder="0.00" value={liters}
                onChange={e => setLiters(e.target.value)}
                className="mt-1 h-8 font-mono border-[#d1d9e6] bg-[#f8fafc]" style={{ fontSize: '13px' }} />
            </div>
            <div>
              <Label htmlFor="d-supplier" className="text-slate-600" style={{ fontSize: '12px' }}>Поставщик <span className="text-slate-400">(необязательно)</span></Label>
              <Input id="d-supplier" value={supplier} onChange={e => setSupplier(e.target.value)}
                className="mt-1 h-8 border-[#d1d9e6] bg-[#f8fafc]" style={{ fontSize: '13px' }} />
            </div>
            <div>
              <Label htmlFor="d-note" className="text-slate-600" style={{ fontSize: '12px' }}>Заметка <span className="text-slate-400">(необязательно)</span></Label>
              <Input id="d-note" value={note} onChange={e => setNote(e.target.value)}
                className="mt-1 h-8 border-[#d1d9e6] bg-[#f8fafc]" style={{ fontSize: '13px' }} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)} className="h-8 border-[#d1d9e6] text-slate-600" style={{ fontSize: '13px' }}>
              Отмена
            </Button>
            <Button onClick={handleSave} disabled={saving} className="h-8 bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-60" style={{ fontSize: '13px' }}>
              {saving ? 'Сохранение…' : 'Сохранить'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
