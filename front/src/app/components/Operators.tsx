import { useState, useEffect } from 'react';
import { Plus, Pencil, UserX } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import { getOperators, createOperator, updateOperator } from '../lib/storage';
import { Operator } from '../types';

export function Operators() {
  const [operators, setOperators] = useState<Operator[]>([]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingOperator, setEditingOperator] = useState<Operator | null>(null);

  const [formName, setFormName] = useState('');

  useEffect(() => {
    let cancelled = false;
    getOperators()
      .then(ops => { if (!cancelled) setOperators(ops); })
      .catch(e => { if (!cancelled) setError(e instanceof Error ? e.message : 'Ошибка загрузки'); });
    return () => { cancelled = true; };
  }, []);

  const handleOpenDialog = (operator?: Operator) => {
    if (operator) {
      setEditingOperator(operator);
      setFormName(operator.name);
    } else {
      setEditingOperator(null);
      setFormName('');
    }
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formName.trim()) {
      alert('Укажите ФИО оператора');
      return;
    }
    setSaving(true);
    try {
      if (editingOperator) {
        const updated = await updateOperator(editingOperator.id, {
          ...editingOperator,
          name: formName.trim(),
        });
        setOperators(prev => prev.map(op => (op.id === updated.id ? updated : op)));
      } else {
        const created = await createOperator({ name: formName.trim() });
        setOperators(prev => [...prev, created]);
      }
      setIsDialogOpen(false);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Не удалось сохранить оператора');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (id: string) => {
    const op = operators.find(o => o.id === id);
    if (!op) return;
    try {
      const updated = await updateOperator(id, { ...op, active: !op.active });
      setOperators(prev => prev.map(o => (o.id === updated.id ? updated : o)));
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Не удалось изменить статус');
    }
  };

  return (
    <div className="space-y-4">
      {error && (
        <div className="px-4 py-2.5 bg-red-50 border border-red-200 rounded-lg text-red-700" style={{ fontSize: '13px' }}>
          {error}
        </div>
      )}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-slate-900" style={{ fontSize: '18px', fontWeight: 600 }}>Операторы</h1>
          <p className="text-slate-500 mt-0.5" style={{ fontSize: '12px' }}>
            {operators.filter(op => op.active).length} активных · {operators.length} всего
          </p>
        </div>
        <Button onClick={() => handleOpenDialog()} className="gap-1.5 bg-blue-600 hover:bg-blue-700 text-white h-8 px-3" style={{ fontSize: '13px' }}>
          <Plus className="size-3.5" />
          Добавить оператора
        </Button>
      </div>

      <div className="bg-white border border-[#d1d9e6] rounded-lg overflow-hidden">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-[#f8fafc] border-b border-[#d1d9e6]">
              <th className="px-4 py-2.5 text-left text-slate-500 border-r border-[#edf0f5]" style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>ФИО</th>
              <th className="px-4 py-2.5 text-center text-slate-500 border-r border-[#edf0f5]" style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Статус</th>
              <th className="px-4 py-2.5 text-right text-slate-500" style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Действия</th>
            </tr>
          </thead>
          <tbody>
            {operators.map((operator, idx) => (
              <tr
                key={operator.id}
                className={`border-b border-[#edf0f5] hover:bg-[#f8fafc] transition-colors ${!operator.active ? 'opacity-60' : ''} ${idx === operators.length - 1 ? 'border-b-0' : ''}`}
              >
                <td className="px-4 py-2.5 text-slate-900 border-r border-[#edf0f5]" style={{ fontSize: '13px' }}>
                  {operator.name}
                </td>
                <td className="px-4 py-2.5 text-center border-r border-[#edf0f5]">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded ${operator.active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}`} style={{ fontSize: '11px', fontWeight: 600 }}>
                    {operator.active ? 'Активен' : 'Неактивен'}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button variant="ghost" size="sm" onClick={() => handleOpenDialog(operator)}
                      className="h-7 px-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50 gap-1" style={{ fontSize: '12px' }}>
                      <Pencil className="size-3" />
                      Изменить
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleToggleActive(operator.id)}
                      className={`h-7 px-2 gap-1 ${operator.active ? 'text-slate-400 hover:text-red-600 hover:bg-red-50' : 'text-emerald-600 hover:bg-emerald-50'}`}
                      style={{ fontSize: '12px' }}>
                      {operator.active ? <><UserX className="size-3" />Деакт.</> : <><Plus className="size-3" />Активировать</>}
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      {/* Edit/Add Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle style={{ fontSize: '15px', fontWeight: 600 }}>
              {editingOperator ? 'Редактирование оператора' : 'Новый оператор'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 py-3">
            <div>
              <Label htmlFor="name" className="text-slate-600" style={{ fontSize: '12px' }}>ФИО</Label>
              <Input id="name" value={formName} onChange={e => setFormName(e.target.value)}
                placeholder="Иванов Иван Иванович"
                className="mt-1 h-8 border-[#d1d9e6] bg-[#f8fafc]" style={{ fontSize: '13px' }} />
            </div>
            <p className="text-slate-400" style={{ fontSize: '11px' }}>
              Зарплатные ставки и бонусы задаются в разделе «Настройки» и зависят от типа смены.
            </p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}
              className="h-8 border-[#d1d9e6] text-slate-600" style={{ fontSize: '13px' }}>
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
