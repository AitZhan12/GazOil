import { useEffect, useMemo, useState } from 'react';
import { Droplets, Pencil, Plus, Trash2 } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { addWaterRecord, deleteWaterRecord, getOperators, getWaterRecords, updateWaterRecord } from '../lib/storage';
import { Operator, WaterRecord } from '../types';

const emptyRecord = (): Omit<WaterRecord, 'id' | 'balanceQuantity'> => ({
  operatorId: '', date: new Date().toISOString().slice(0, 10), time: '', receivedQuantity: 0, deliveryQuantity: 0, soldQuantity: 0,
});

export function WaterJournal() {
  const [operators, setOperators] = useState<Operator[]>([]);
  const [records, setRecords] = useState<WaterRecord[]>([]);
  const [form, setForm] = useState(emptyRecord);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([getOperators(), getWaterRecords()]).then(([ops, water]) => {
      setOperators(ops.filter(op => op.active)); setRecords(water);
    }).catch(e => setError(e instanceof Error ? e.message : 'Ошибка загрузки'));
  }, []);

  const balancePreview = form.receivedQuantity + form.deliveryQuantity - form.soldQuantity;
  const getOperatorName = (id: string) => operators.find(op => op.id === id)?.name || 'Неизвестно';
  const totalSold = useMemo(() => records.reduce((total, record) => total + record.soldQuantity, 0), [records]);
  const setNumber = (field: 'receivedQuantity' | 'deliveryQuantity' | 'soldQuantity', value: string) =>
    setForm(prev => ({ ...prev, [field]: Math.max(0, Number(value) || 0) }));

  const resetForm = () => { setForm(emptyRecord()); setEditingId(null); };
  const edit = (record: WaterRecord) => {
    setEditingId(record.id);
    setForm({ operatorId: record.operatorId, date: record.date, time: record.time, receivedQuantity: record.receivedQuantity, deliveryQuantity: record.deliveryQuantity, soldQuantity: record.soldQuantity });
  };
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.operatorId || !form.date || !form.time) { setError('Укажите оператора, дату и время'); return; }
    setSaving(true); setError('');
    try {
      const saved = editingId ? await updateWaterRecord(editingId, form) : await addWaterRecord(form);
      setRecords(prev => editingId ? prev.map(record => record.id === saved.id ? saved : record) : [saved, ...prev]);
      resetForm();
    } catch (e) { setError(e instanceof Error ? e.message : 'Не удалось сохранить запись'); }
    finally { setSaving(false); }
  };
  const remove = async (id: string) => {
    if (!confirm('Удалить запись воды?')) return;
    try { await deleteWaterRecord(id); setRecords(prev => prev.filter(record => record.id !== id)); }
    catch (e) { setError(e instanceof Error ? e.message : 'Не удалось удалить запись'); }
  };

  return <div className="space-y-4">
    <div className="flex items-center justify-between gap-3 flex-wrap">
      <div><h1 className="text-slate-900" style={{ fontSize: '18px', fontWeight: 600 }}>Журнал воды</h1><p className="text-slate-500 mt-0.5" style={{ fontSize: '12px' }}>Учёт прихода, продажи и остатка воды</p></div>
      <Button type="button" onClick={resetForm} className="gap-1.5 bg-blue-600 hover:bg-blue-700 text-white h-8 px-3" style={{ fontSize: '13px' }}><Plus className="size-3.5" />Новая запись</Button>
    </div>
    {error && <div className="px-4 py-2.5 bg-red-50 border border-red-200 rounded-lg text-red-700" style={{ fontSize: '13px' }}>{error}</div>}
    <form onSubmit={submit} className="bg-white border border-[#d1d9e6] rounded-lg overflow-hidden">
      <div className="px-5 py-3 bg-[#f8fafc] border-b border-[#d1d9e6] flex items-center gap-2"><Droplets className="size-4 text-blue-600" /><span className="text-slate-700" style={{ fontSize: '13px', fontWeight: 600 }}>{editingId ? 'Редактирование записи' : 'Новая запись'}</span></div>
      <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 items-end">
        <div><Label className="text-slate-600" style={{ fontSize: '12px' }}>Оператор</Label><Select value={form.operatorId} onValueChange={operatorId => setForm(prev => ({ ...prev, operatorId }))}><SelectTrigger className="h-8 mt-1 bg-[#f8fafc]" style={{ fontSize: '13px' }}><SelectValue placeholder="Выберите..." /></SelectTrigger><SelectContent>{operators.map(op => <SelectItem key={op.id} value={op.id}>{op.name}</SelectItem>)}</SelectContent></Select></div>
        <div><Label className="text-slate-600" style={{ fontSize: '12px' }}>Дата</Label><Input required type="date" value={form.date} onChange={e => setForm(prev => ({ ...prev, date: e.target.value }))} className="h-8 mt-1 bg-[#f8fafc]" /></div>
        <div><Label className="text-slate-600" style={{ fontSize: '12px' }}>Время</Label><Input required type="time" value={form.time} onChange={e => setForm(prev => ({ ...prev, time: e.target.value }))} className="h-8 mt-1 bg-[#f8fafc]" /></div>
        <div><Label className="text-slate-600" style={{ fontSize: '12px' }}>Пришел, шт.</Label><Input min="0" type="number" value={form.receivedQuantity} onChange={e => setNumber('receivedQuantity', e.target.value)} className="h-8 mt-1 font-mono bg-[#f8fafc]" /></div>
        <div><Label className="text-slate-600" style={{ fontSize: '12px' }}>Приход, шт.</Label><Input min="0" type="number" value={form.deliveryQuantity} onChange={e => setNumber('deliveryQuantity', e.target.value)} className="h-8 mt-1 font-mono bg-[#f8fafc]" /></div>
        <div><Label className="text-slate-600" style={{ fontSize: '12px' }}>Продал, шт.</Label><Input min="0" type="number" value={form.soldQuantity} onChange={e => setNumber('soldQuantity', e.target.value)} className="h-8 mt-1 font-mono bg-[#f8fafc]" /></div>
      </div>
      <div className="px-4 pb-4 flex items-center gap-3"><span className={`text-sm ${balancePreview < 0 ? 'text-red-600' : 'text-slate-600'}`}>Сдал: <strong className="font-mono">{balancePreview.toLocaleString('ru-RU')} шт.</strong></span><Button disabled={saving} type="submit" className="h-8 bg-blue-600 hover:bg-blue-700 text-white">{saving ? 'Сохранение...' : 'Сохранить'}</Button>{editingId && <Button type="button" variant="outline" onClick={resetForm} className="h-8">Отмена</Button>}</div>
    </form>
    <div className="bg-white border border-[#d1d9e6] rounded-lg overflow-hidden"><div className="overflow-x-auto"><table className="w-full min-w-[760px] border-collapse"><thead><tr className="bg-[#f8fafc] border-b border-[#d1d9e6]">{['Дата / время', 'Оператор', 'Пришел', 'Приход', 'Продал', 'Сдал', ''].map(label => <th key={label} className="px-4 py-2.5 text-left text-slate-500 border-r border-[#edf0f5]" style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase' }}>{label}</th>)}</tr></thead><tbody>{records.map(record => <tr key={record.id} className="border-b border-[#edf0f5] hover:bg-[#f8fafc]"><td className="px-4 py-2.5 font-mono text-slate-700">{new Date(`${record.date}T00:00`).toLocaleDateString('ru-RU')} <span className="text-slate-400">{record.time}</span></td><td className="px-4 py-2.5 text-slate-700">{getOperatorName(record.operatorId)}</td><td className="px-4 py-2.5 font-mono">{record.receivedQuantity}</td><td className="px-4 py-2.5 font-mono">{record.deliveryQuantity}</td><td className="px-4 py-2.5 font-mono">{record.soldQuantity}</td><td className={`px-4 py-2.5 font-mono font-medium ${record.balanceQuantity < 0 ? 'text-red-600' : 'text-slate-900'}`}>{record.balanceQuantity}</td><td className="px-4 py-2.5"><div className="flex gap-1 justify-end"><Button type="button" variant="ghost" size="sm" onClick={() => edit(record)} className="h-7 w-7 p-0 text-blue-600"><Pencil className="size-3.5" /></Button><Button type="button" variant="ghost" size="sm" onClick={() => remove(record.id)} className="h-7 w-7 p-0 text-slate-400 hover:text-red-600"><Trash2 className="size-3.5" /></Button></div></td></tr>)}</tbody><tfoot><tr className="bg-[#f0f2f5]"><td colSpan={4} className="px-4 py-2.5 text-slate-500" style={{ fontSize: '12px', fontWeight: 600 }}>Итого продано</td><td className="px-4 py-2.5 font-mono font-semibold">{totalSold}</td><td colSpan={2} /></tr></tfoot></table></div></div>
  </div>;
}
