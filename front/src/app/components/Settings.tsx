import { useEffect, useState } from 'react';
import { Save, Plus, Trash2, AlertTriangle, Check } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { getSettings, updateSettings, getFuelPrice, updateFuelPrice } from '../lib/storage';
import { AppSettings, BonusTier, FuelPrice } from '../types';

export function Settings() {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [fuelPrice, setFuelPrice] = useState<FuelPrice | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([getSettings(), getFuelPrice()])
      .then(([s, p]) => { if (!cancelled) { setSettings(s); setFuelPrice(p); } })
      .catch(e => { if (!cancelled) setError(e instanceof Error ? e.message : 'Ошибка загрузки настроек'); });
    return () => { cancelled = true; };
  }, []);

  const patch = (p: Partial<AppSettings>) => {
    setSaved(false);
    setSettings(prev => (prev ? { ...prev, ...p } : prev));
  };

  const patchPrice = (p: Partial<FuelPrice>) => {
    setSaved(false);
    setFuelPrice(prev => (prev ? { ...prev, ...p } : prev));
  };

  const num = (v: string) => (v === '' ? 0 : parseFloat(v) || 0);

  const setTier = (idx: number, field: keyof BonusTier, value: string) => {
    if (!settings) return;
    const tiers = settings.bonusTiers.map((t, i) => (i === idx ? { ...t, [field]: num(value) } : t));
    patch({ bonusTiers: tiers });
  };

  const addTier = () => {
    if (!settings) return;
    patch({ bonusTiers: [...settings.bonusTiers, { thresholdLiters: 0, bonusAmount: 0 }] });
  };

  const removeTier = (idx: number) => {
    if (!settings) return;
    patch({ bonusTiers: settings.bonusTiers.filter((_, i) => i !== idx) });
  };

  const handleSave = async () => {
    if (!settings || !fuelPrice) return;
    setSaving(true);
    setError('');
    try {
      // Сортируем ступени по планке и сохраняем ставки/бонусы и цены 107/112.
      const ordered = [...settings.bonusTiers].sort((a, b) => a.thresholdLiters - b.thresholdLiters);
      const [result, price] = await Promise.all([
        updateSettings({ ...settings, bonusTiers: ordered }),
        updateFuelPrice(fuelPrice),
      ]);
      setSettings(result);
      setFuelPrice(price);
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось сохранить настройки');
    } finally {
      setSaving(false);
    }
  };

  const cardClass = 'bg-white border border-[#d1d9e6] rounded-lg overflow-hidden';
  const headerClass = 'px-5 py-3 bg-[#f8fafc] border-b border-[#d1d9e6]';
  const bodyClass = 'px-5 py-4';

  const rateField = (id: string, label: string, value: number, onChange: (v: string) => void) => (
    <div className="flex items-center gap-3">
      <Label htmlFor={id} className="text-slate-600 w-40 sm:w-56 shrink-0" style={{ fontSize: '12px' }}>{label}</Label>
      <Input id={id} type="number" step="0.01" value={value} onChange={e => onChange(e.target.value)}
        className="h-8 font-mono border-[#d1d9e6] bg-[#f8fafc] flex-1" style={{ fontSize: '13px' }} />
    </div>
  );

  return (
    <div className="space-y-4 w-full">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-slate-900" style={{ fontSize: '18px', fontWeight: 600 }}>Настройки</h1>
        </div>
        <Button onClick={handleSave} disabled={saving || !settings || !fuelPrice} className="gap-1.5 bg-blue-600 hover:bg-blue-700 text-white h-8 px-3 disabled:opacity-60" style={{ fontSize: '13px' }}>
          {saved ? <Check className="size-3.5" /> : <Save className="size-3.5" />}
          {saving ? 'Сохранение…' : saved ? 'Сохранено' : 'Сохранить'}
        </Button>
      </div>

      {error && (
        <div className="px-4 py-2.5 flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg text-red-700" style={{ fontSize: '13px' }}>
          <AlertTriangle className="size-4 shrink-0" />
          {error}
        </div>
      )}

      {!settings || !fuelPrice ? (
        <div className="bg-white border border-[#d1d9e6] rounded-lg p-12 text-center text-slate-400" style={{ fontSize: '14px' }}>
          Загрузка настроек…
        </div>
      ) : (
        <>
          {/* Ставки за смену */}
          <div className={cardClass}>
            <div className={headerClass}>
              <span className="text-slate-700" style={{ fontSize: '13px', fontWeight: 600 }}>Ставки за смену (₸)</span>
            </div>
            <div className={`${bodyClass} space-y-2.5`}>
              {rateField('rateFull', 'Сутки', settings.rateFull, v => patch({ rateFull: num(v) }))}
              {rateField('rateDay', 'День', settings.rateDay, v => patch({ rateDay: num(v) }))}
              {rateField('rateNight', 'Ночь', settings.rateNight, v => patch({ rateNight: num(v) }))}
            </div>
          </div>

          {/* Цены 107/112 */}
          <div className={cardClass}>
            <div className={headerClass}>
              <span className="text-slate-700" style={{ fontSize: '13px', fontWeight: 600 }}>Цены (₸/л)</span>
            </div>
            <div className={`${bodyClass} space-y-2.5`}>
              {rateField('discountPrice', 'Дисконтная (107)', fuelPrice.discountPrice, v => patchPrice({ discountPrice: num(v) }))}
              {rateField('basePrice', 'Основная (112)', fuelPrice.basePrice, v => patchPrice({ basePrice: num(v) }))}
              <p className="text-slate-400" style={{ fontSize: '11px' }}>Снапшотятся в смену при её создании. Изменение влияет только на новые смены — прошлые сохраняют свою цену.</p>
            </div>
          </div>

          {/* Учёт остатка газа */}
          <div className={cardClass}>
            <div className={headerClass}>
              <span className="text-slate-700" style={{ fontSize: '13px', fontWeight: 600 }}>Учёт остатка газа (л)</span>
            </div>
            <div className={`${bodyClass} space-y-2.5`}>
              {rateField('initialStockLiters', 'Начальный остаток', settings.initialStockLiters, v => patch({ initialStockLiters: num(v) }))}
              {rateField('tankCapacityLiters', 'Объём резервуара', settings.tankCapacityLiters, v => patch({ tankCapacityLiters: num(v) }))}
              {rateField('measurementToleranceLiters', 'Погрешность замера', settings.measurementToleranceLiters, v => patch({ measurementToleranceLiters: num(v) }))}
              <p className="text-slate-400" style={{ fontSize: '11px' }}>
                Бегущий остаток = начальный остаток + приход − реализация смен (по времени). Объём резервуара = 0 — контроль перелива выключен. Приход вносится в разделе «Приход газа».
              </p>
              <p className="text-slate-400" style={{ fontSize: '11px' }}>
                Погрешность замера — допустимое расхождение при заливке (обычно до 1000 л). В её пределах минус и перелив остатка не подсвечиваются как проблема. Когда газ заканчивается, остаток обнуляют кнопкой «Обнулить резервуар» в разделе «Приход газа».
              </p>
            </div>
          </div>

          {/* Таблица бонусов */}
          <div className={cardClass}>
            <div className={`${headerClass} flex items-center justify-between`}>
              <span className="text-slate-700" style={{ fontSize: '13px', fontWeight: 600 }}>Ступени бонуса за объём</span>
              <Button onClick={addTier} variant="ghost" size="sm" className="h-7 px-2 text-blue-600 hover:bg-blue-50 gap-1" style={{ fontSize: '12px' }}>
                <Plus className="size-3" />
                Ступень
              </Button>
            </div>
            <div className="overflow-x-auto">
            <table className="w-full border-collapse min-w-[420px]">
              <thead>
                <tr className="bg-[#f8fafc] border-b border-[#d1d9e6]">
                  <th className="px-5 py-2 text-left text-slate-500 border-r border-[#edf0f5]" style={{ fontSize: '11px', fontWeight: 600 }}>Планка объёма (л)</th>
                  <th className="px-5 py-2 text-left text-slate-500 border-r border-[#edf0f5]" style={{ fontSize: '11px', fontWeight: 600 }}>Бонус (₸)</th>
                  <th className="px-5 py-2 w-12" />
                </tr>
              </thead>
              <tbody>
                {settings.bonusTiers.length === 0 ? (
                  <tr><td colSpan={3} className="px-5 py-4 text-center text-slate-400" style={{ fontSize: '13px' }}>Ступеней нет — бонус всегда 0</td></tr>
                ) : (
                  settings.bonusTiers.map((tier, idx) => (
                    <tr key={idx} className="border-b border-[#edf0f5] last:border-b-0">
                      <td className="px-5 py-2 border-r border-[#edf0f5]">
                        <Input type="number" step="0.01" value={tier.thresholdLiters} onChange={e => setTier(idx, 'thresholdLiters', e.target.value)}
                          className="h-8 font-mono border-[#d1d9e6] bg-[#f8fafc]" style={{ fontSize: '13px' }} />
                      </td>
                      <td className="px-5 py-2 border-r border-[#edf0f5]">
                        <Input type="number" step="0.01" value={tier.bonusAmount} onChange={e => setTier(idx, 'bonusAmount', e.target.value)}
                          className="h-8 font-mono border-[#d1d9e6] bg-[#f8fafc]" style={{ fontSize: '13px' }} />
                      </td>
                      <td className="px-5 py-2 text-center">
                        <Button onClick={() => removeTier(idx)} variant="ghost" size="sm" className="h-7 w-7 p-0 text-slate-400 hover:text-red-600 hover:bg-red-50">
                          <Trash2 className="size-3.5" />
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            </div>
            <div className="px-5 py-3 border-t border-[#edf0f5] text-slate-400" style={{ fontSize: '11px' }}>
              Берётся высшая ступень, чью планку перешагнул объём смены. Ниже минимальной планки — бонуса нет.
            </div>
          </div>
        </>
      )}
    </div>
  );
}
