import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router';
import { ArrowLeft, Save, AlertTriangle } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { getOperators, getShiftById, addShift, updateShift, getSettings, getFuelPrice } from '../lib/storage';
import { calculateShiftFields, formatCurrency, formatLiters, formatNumber, salaryRateFor, bonusForLiters } from '../lib/calculations';
import { getLastPumpReadings } from '../lib/shift-helpers';
import { Shift, PumpReading, Operator, AppSettings, ShiftType, SHIFT_TYPE_LABELS } from '../types';

// Формат СНГ: дата вводится как ДД.ММ.ГГГГ, а внутри храним ISO (ГГГГ-ММ-ДД).
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

// Время — 24-часовое ЧЧ:ММ (внутренний формат HH:MM совпадает с отображаемым).
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

export function ShiftForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEditing = !!id;

  const [operators, setOperators] = useState<Operator[]>([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState('');

  const [operatorId, setOperatorId] = useState('');
  const [receivedById, setReceivedById] = useState('');
  const [shiftType, setShiftType] = useState<ShiftType>('full');
  const [startDate, setStartDate] = useState('');       // ISO (источник правды)
  const [startDateText, setStartDateText] = useState(''); // ДД.ММ.ГГГГ (показ/ввод)
  const [startTime, setStartTime] = useState('');
  const [endDate, setEndDate] = useState('');
  const [endDateText, setEndDateText] = useState('');
  const [endTime, setEndTime] = useState('');

  // Ожидаемое «начало» по колонкам = «конец» прошлой смены (для контроля непрерывности).
  const [expectedStarts, setExpectedStarts] = useState<number[] | null>(null);

  const [pump1Start, setPump1Start] = useState('');
  const [pump1End, setPump1End] = useState('');
  const [pump2Start, setPump2Start] = useState('');
  const [pump2End, setPump2End] = useState('');
  const [pump3Start, setPump3Start] = useState('');
  const [pump3End, setPump3End] = useState('');

  const [voucherLiters, setVoucherLiters] = useState('');
  const [cardLiters, setCardLiters] = useState('');
  const [discountLiters, setDiscountLiters] = useState('');
  // Цены 107/112 — снапшот смены, владелец их в форме не вводит (read-only множитель).
  const [discountPrice, setDiscountPrice] = useState('');
  const [regularPrice, setRegularPrice] = useState('');
  const [kaspiQR, setKaspiQR] = useState('');
  const [kaspiTransfer, setKaspiTransfer] = useState('');

  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;

    const fillFromShift = (shift: Shift) => {
      setOperatorId(shift.operatorId);
      setReceivedById(shift.receivedById || '');
      setShiftType(shift.shiftType ?? 'full');
      setStartDate(shift.startDate);
      setStartDateText(isoToRu(shift.startDate));
      setStartTime(shift.startTime);
      setEndDate(shift.endDate);
      setEndDateText(isoToRu(shift.endDate));
      setEndTime(shift.endTime);
      setPump1Start(shift.pumps[0]?.start.toString() ?? '');
      setPump1End(shift.pumps[0]?.end.toString() ?? '');
      setPump2Start(shift.pumps[1]?.start.toString() ?? '');
      setPump2End(shift.pumps[1]?.end.toString() ?? '');
      setPump3Start(shift.pumps[2]?.start.toString() ?? '');
      setPump3End(shift.pumps[2]?.end.toString() ?? '');
      setVoucherLiters(shift.voucherLiters.toString());
      setCardLiters(shift.cardLiters.toString());
      setDiscountLiters(shift.discountLiters.toString());
      setDiscountPrice(shift.discountPrice.toString());
      setRegularPrice(shift.regularPrice.toString());
      setKaspiQR(shift.kaspiQR.toString());
      setKaspiTransfer(shift.kaspiTransfer.toString());
    };

    async function load() {
      try {
        const [ops, appSettings] = await Promise.all([getOperators(), getSettings()]);
        if (cancelled) return;
        setOperators(ops.filter(op => op.active));
        setSettings(appSettings);

        if (isEditing && id) {
          const shift = await getShiftById(id);
          if (cancelled) return;
          if (shift) fillFromShift(shift);
          else setLoadError('Смена не найдена');
        } else {
          const now = new Date();
          const today = now.toISOString().split('T')[0];
          setStartDate(today);
          setStartDateText(isoToRu(today));
          setEndDate(today);
          setEndDateText(isoToRu(today));
          // Цены 107/112 для новой смены — из общих настроек (снапшот сделает бэк).
          const price = await getFuelPrice();
          if (cancelled) return;
          setDiscountPrice(String(price.discountPrice));
          setRegularPrice(String(price.basePrice));
          const lastReadings = await getLastPumpReadings();
          if (cancelled) return;
          if (lastReadings && lastReadings.length === 3) {
            const ends = lastReadings.map(r => r.end);
            // Контроль непрерывности включаем только при наличии реальной прошлой смены
            // (иначе на самой первой смене был бы ложный «разрыв» против нулей).
            if (ends.some(e => e > 0)) setExpectedStarts(ends);
            setPump1Start(ends[0].toString());
            setPump2Start(ends[1].toString());
            setPump3Start(ends[2].toString());
          }
        }
      } catch (e) {
        if (!cancelled) setLoadError(e instanceof Error ? e.message : 'Ошибка загрузки');
      }
    }

    load();
    return () => { cancelled = true; };
  }, [id, isEditing]);

  const pump1Volume = (parseFloat(pump1End) || 0) - (parseFloat(pump1Start) || 0);
  const pump2Volume = (parseFloat(pump2End) || 0) - (parseFloat(pump2Start) || 0);
  const pump3Volume = (parseFloat(pump3End) || 0) - (parseFloat(pump3Start) || 0);

  const pumps = [
    { start: parseFloat(pump1Start) || 0, end: parseFloat(pump1End) || 0 },
    { start: parseFloat(pump2Start) || 0, end: parseFloat(pump2End) || 0 },
    { start: parseFloat(pump3Start) || 0, end: parseFloat(pump3End) || 0 },
  ];

  const dPrice = parseFloat(discountPrice) || 0;
  const bPrice = parseFloat(regularPrice) || 0;

  const calculated = calculateShiftFields(
    pumps,
    parseFloat(voucherLiters) || 0,
    parseFloat(cardLiters) || 0,
    parseFloat(discountLiters) || 0,
    dPrice,
    bPrice,
    parseFloat(kaspiQR) || 0,
    parseFloat(kaspiTransfer) || 0
  );

  // Контроль непрерывности: «начало» новой смены должно совпасть с «концом» прошлой.
  // Если оператор изменил подставленное значение — это сигнал (опечатка/пропуск смены).
  const continuityMismatches = (!isEditing && expectedStarts)
    ? [pump1Start, pump2Start, pump3Start]
        .map((s, i) => ({ pump: i + 1, entered: parseFloat(s) || 0, expected: expectedStarts[i] }))
        .filter(m => Math.abs(m.entered - m.expected) > 0.005)
    : [];

  // Превью зарплаты за смену (бэк пересчитает при сохранении).
  const baseSalaryPreview = salaryRateFor(settings, shiftType);
  const bonusPreview = bonusForLiters(settings, calculated.totalLiters);

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!operatorId) newErrors.operatorId = 'Выберите оператора';
    if (!startDate) newErrors.startDate = 'Укажите дату начала';
    if (!startTime) newErrors.startTime = 'Укажите время начала';
    else if (!isValidTime(startTime)) newErrors.startTime = 'Время в формате ЧЧ:ММ';
    if (!endDate) newErrors.endDate = 'Укажите дату окончания';
    if (!endTime) newErrors.endTime = 'Укажите время окончания';
    else if (!isValidTime(endTime)) newErrors.endTime = 'Время в формате ЧЧ:ММ';
    if (pump1Volume < 0) newErrors.pump1 = 'Конец смены должен быть больше начала';
    if (pump2Volume < 0) newErrors.pump2 = 'Конец смены должен быть больше начала';
    if (pump3Volume < 0) newErrors.pump3 = 'Конец смены должен быть больше начала';
    const startDateTime = new Date(`${startDate}T${startTime}`);
    const endDateTime = new Date(`${endDate}T${endTime}`);
    if (endDateTime <= startDateTime) newErrors.endTime = 'Время окончания должно быть позже времени начала';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate() || saving) return;
    const pumpReadings: PumpReading[] = [
      { pumpNumber: 1, start: parseFloat(pump1Start) || 0, end: parseFloat(pump1End) || 0, volume: pump1Volume },
      { pumpNumber: 2, start: parseFloat(pump2Start) || 0, end: parseFloat(pump2End) || 0, volume: pump2Volume },
      { pumpNumber: 3, start: parseFloat(pump3Start) || 0, end: parseFloat(pump3End) || 0, volume: pump3Volume },
    ];
    const shift: Shift = {
      id: isEditing ? (id as string) : '',
      operatorId, receivedById: receivedById || undefined,
      shiftType,
      startDate, startTime, endDate, endTime,
      pumps: pumpReadings,
      voucherLiters: parseFloat(voucherLiters) || 0,
      cardLiters: parseFloat(cardLiters) || 0,
      discountLiters: parseFloat(discountLiters) || 0,
      kaspiQR: parseFloat(kaspiQR) || 0,
      kaspiTransfer: parseFloat(kaspiTransfer) || 0,
      discountPrice: dPrice,
      regularPrice: bPrice,
      ...calculated,
      baseSalary: baseSalaryPreview,
      bonus: bonusPreview,
      payout: baseSalaryPreview + bonusPreview,
    };
    setSaving(true);
    try {
      if (isEditing && id) await updateShift(id, shift);
      else await addShift(shift);
      navigate('/');
    } catch (err) {
      setErrors({ submit: err instanceof Error ? err.message : 'Не удалось сохранить смену' });
      setSaving(false);
    }
  };

  const sectionClass = 'bg-white border border-[#d1d9e6] rounded-lg overflow-hidden';
  const sectionHeaderClass = 'px-5 py-3 bg-[#f8fafc] border-b border-[#d1d9e6] flex items-center gap-2';
  const sectionBodyClass = 'px-5 py-4';
  const sectionTitleClass = 'text-slate-700';

  // Строка-ввод блока «ИЗ НИХ»: подпись + поле + единица (литры или ₸).
  const cashRowInput = (
    id: string, label: string, value: string,
    set: (v: string) => void, unit: string,
  ) => (
    <div className="flex items-center justify-between gap-3 py-1.5 border-b border-[#edf0f5]">
      <Label htmlFor={id} className="text-slate-600 shrink-0" style={{ fontSize: '12px', fontWeight: 400 }}>{label}</Label>
      <div className="flex items-center gap-1.5">
        <Input id={id} type="number" step="0.01" value={value} onChange={e => set(e.target.value)} placeholder="0.00"
          className="h-8 w-28 font-mono border-[#d1d9e6] bg-[#f8fafc] text-right" style={{ fontSize: '13px' }} />
        <span className="text-slate-400" style={{ fontSize: '12px' }}>{unit}</span>
      </div>
    </div>
  );

  // Строка-расчёт блока «ИЗ НИХ»: подпись + вычисленное значение (read-only).
  const cashRowValue = (label: string, value: string) => (
    <div className="flex items-center justify-between gap-3 py-1.5 border-b border-[#edf0f5]">
      <span className="text-slate-600" style={{ fontSize: '12px' }}>{label}</span>
      <span className="font-mono text-slate-800" style={{ fontSize: '13px', fontWeight: 500 }}>{value}</span>
    </div>
  );

  return (
    <div className="w-full">
      {/* Page header */}
      <div className="flex items-center gap-3 mb-5">
        <button
          type="button"
          onClick={() => navigate('/')}
          className="flex items-center gap-1.5 text-slate-500 hover:text-slate-800 transition-colors"
          style={{ fontSize: '13px' }}
        >
          <ArrowLeft className="size-3.5" />
          Назад
        </button>
        <span className="text-slate-300">/</span>
        <h1 className="text-slate-900" style={{ fontSize: '18px', fontWeight: 600 }}>
          {isEditing ? 'Редактирование смены' : 'Новая смена'}
        </h1>
      </div>

      {loadError && (
        <div className="mb-4 px-4 py-2.5 flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg text-red-700" style={{ fontSize: '13px' }}>
          <AlertTriangle className="size-4 shrink-0" />
          {loadError}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Блок А — Шапка */}
        <div className={sectionClass}>
          <div className={sectionHeaderClass}>
            <span className="size-5 rounded bg-blue-600 text-white flex items-center justify-center shrink-0" style={{ fontSize: '10px', fontWeight: 700 }}>А</span>
            <span className={sectionTitleClass} style={{ fontSize: '13px', fontWeight: 600 }}>Шапка смены</span>
          </div>
          <div className={sectionBodyClass}>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="operator" className="required text-slate-600" style={{ fontSize: '12px' }}>Оператор</Label>
                <Select value={operatorId} onValueChange={setOperatorId}>
                  <SelectTrigger id="operator" className={`h-8 border-[#d1d9e6] bg-[#f8fafc] mt-1 ${errors.operatorId ? 'border-red-400' : ''}`} style={{ fontSize: '13px' }}>
                    <SelectValue placeholder="Выберите…" />
                  </SelectTrigger>
                  <SelectContent>
                    {operators.map(op => (
                      <SelectItem key={op.id} value={op.id} style={{ fontSize: '13px' }}>{op.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.operatorId && <p className="text-red-500 mt-1" style={{ fontSize: '11px' }}>{errors.operatorId}</p>}
              </div>

              <div>
                <Label htmlFor="receivedBy" className="text-slate-600" style={{ fontSize: '12px' }}>Принял смену</Label>
                <Select value={receivedById || 'none'} onValueChange={v => setReceivedById(v === 'none' ? '' : v)}>
                  <SelectTrigger id="receivedBy" className="h-8 border-[#d1d9e6] bg-[#f8fafc] mt-1" style={{ fontSize: '13px' }}>
                    <SelectValue placeholder="Не указано" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none" style={{ fontSize: '13px' }}>Не указано</SelectItem>
                    {operators.map(op => (
                      <SelectItem key={op.id} value={op.id} style={{ fontSize: '13px' }}>{op.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label htmlFor="startDate" className="required text-slate-600" style={{ fontSize: '12px' }}>Дата начала</Label>
                  <Input id="startDate" inputMode="numeric" placeholder="ДД.ММ.ГГГГ" value={startDateText}
                    onChange={e => { const v = maskRuDate(e.target.value); setStartDateText(v); setStartDate(ruToIso(v)); }}
                    className={`h-8 font-mono border-[#d1d9e6] bg-[#f8fafc] mt-1 ${errors.startDate ? 'border-red-400' : ''}`} style={{ fontSize: '13px' }} />
                </div>
                <div>
                  <Label htmlFor="startTime" className="required text-slate-600" style={{ fontSize: '12px' }}>Время начала</Label>
                  <Input id="startTime" inputMode="numeric" placeholder="ЧЧ:ММ" value={startTime}
                    onChange={e => setStartTime(maskTime(e.target.value))}
                    className={`h-8 font-mono border-[#d1d9e6] bg-[#f8fafc] mt-1 ${errors.startTime ? 'border-red-400' : ''}`} style={{ fontSize: '13px' }} />
                </div>
              </div>

              <div>
                <Label htmlFor="shiftType" className="required text-slate-600" style={{ fontSize: '12px' }}>Тип смены</Label>
                <Select value={shiftType} onValueChange={v => setShiftType(v as ShiftType)}>
                  <SelectTrigger id="shiftType" className="h-8 border-[#d1d9e6] bg-[#f8fafc] mt-1" style={{ fontSize: '13px' }}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(['full', 'day', 'night'] as ShiftType[]).map(t => (
                      <SelectItem key={t} value={t} style={{ fontSize: '13px' }}>{SHIFT_TYPE_LABELS[t]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="hidden lg:block" />
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label htmlFor="endDate" className="required text-slate-600" style={{ fontSize: '12px' }}>Дата конца</Label>
                  <Input id="endDate" inputMode="numeric" placeholder="ДД.ММ.ГГГГ" value={endDateText}
                    onChange={e => { const v = maskRuDate(e.target.value); setEndDateText(v); setEndDate(ruToIso(v)); }}
                    className={`h-8 font-mono border-[#d1d9e6] bg-[#f8fafc] mt-1 ${errors.endDate ? 'border-red-400' : ''}`} style={{ fontSize: '13px' }} />
                </div>
                <div>
                  <Label htmlFor="endTime" className="required text-slate-600" style={{ fontSize: '12px' }}>Время конца</Label>
                  <Input id="endTime" inputMode="numeric" placeholder="ЧЧ:ММ" value={endTime}
                    onChange={e => setEndTime(maskTime(e.target.value))}
                    className={`h-8 font-mono border-[#d1d9e6] bg-[#f8fafc] mt-1 ${errors.endTime ? 'border-red-400' : ''}`} style={{ fontSize: '13px' }} />
                  {errors.endTime && <p className="text-red-500 mt-1" style={{ fontSize: '11px' }}>{errors.endTime}</p>}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Блок Б — Показания колонок */}
        <div className={sectionClass}>
          <div className={sectionHeaderClass}>
            <span className="size-5 rounded bg-blue-600 text-white flex items-center justify-center shrink-0" style={{ fontSize: '10px', fontWeight: 700 }}>Б</span>
            <span className={sectionTitleClass} style={{ fontSize: '13px', fontWeight: 600 }}>Показания колонок</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-[#f8fafc] border-b border-[#d1d9e6]">
                  <th className="px-4 py-2.5 text-left text-slate-500 w-20 border-r border-[#edf0f5]" style={{ fontSize: '11px', fontWeight: 600 }}>Колонка</th>
                  <th className="px-4 py-2.5 text-left text-slate-500 border-r border-[#edf0f5]" style={{ fontSize: '11px', fontWeight: 600 }}>Начало смены</th>
                  <th className="px-4 py-2.5 text-left text-slate-500 border-r border-[#edf0f5]" style={{ fontSize: '11px', fontWeight: 600 }}>Конец смены</th>
                  <th className="px-4 py-2.5 text-left text-slate-500" style={{ fontSize: '11px', fontWeight: 600 }}>Реализация (л)</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { num: 1, start: pump1Start, setStart: setPump1Start, end: pump1End, setEnd: setPump1End, volume: pump1Volume, err: errors.pump1 },
                  { num: 2, start: pump2Start, setStart: setPump2Start, end: pump2End, setEnd: setPump2End, volume: pump2Volume, err: errors.pump2 },
                  { num: 3, start: pump3Start, setStart: setPump3Start, end: pump3End, setEnd: setPump3End, volume: pump3Volume, err: errors.pump3 },
                ].map(pump => (
                  <tr key={pump.num} className="border-b border-[#edf0f5]">
                    <td className="px-4 py-2 border-r border-[#edf0f5]">
                      <span className="inline-flex items-center justify-center size-6 rounded bg-slate-100 text-slate-700" style={{ fontSize: '12px', fontWeight: 600 }}>{pump.num}</span>
                    </td>
                    <td className="px-4 py-2 border-r border-[#edf0f5]">
                      <Input type="number" step="0.01" value={pump.start} onChange={e => pump.setStart(e.target.value)}
                        className={`h-8 font-mono border-[#d1d9e6] bg-[#f8fafc] ${pump.err ? 'border-red-400' : ''}`} style={{ fontSize: '13px' }} placeholder="0.00" />
                    </td>
                    <td className="px-4 py-2 border-r border-[#edf0f5]">
                      <Input type="number" step="0.01" value={pump.end} onChange={e => pump.setEnd(e.target.value)}
                        className={`h-8 font-mono border-[#d1d9e6] bg-[#f8fafc] ${pump.err ? 'border-red-400' : ''}`} style={{ fontSize: '13px' }} placeholder="0.00" />
                    </td>
                    <td className="px-4 py-2 bg-[#f8fafc]">
                      <span className="font-mono text-slate-900" style={{ fontSize: '13px', fontWeight: 500 }}>{formatLiters(pump.volume)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-blue-50 border-t-2 border-blue-200">
                  <td colSpan={3} className="px-4 py-2.5 text-right text-blue-700 border-r border-blue-200" style={{ fontSize: '12px', fontWeight: 600 }}>
                    Итого реализация:
                  </td>
                  <td className="px-4 py-2.5 font-mono text-blue-900" style={{ fontSize: '14px', fontWeight: 700 }}>
                    {formatLiters(calculated.totalLiters)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
          {(errors.pump1 || errors.pump2 || errors.pump3) && (
            <div className="px-5 py-2 flex items-center gap-1.5 text-red-600" style={{ fontSize: '12px' }}>
              <AlertTriangle className="size-3.5" />
              {errors.pump1 || errors.pump2 || errors.pump3}
            </div>
          )}
          {continuityMismatches.length > 0 && (
            <div className="px-5 py-2.5 flex items-start gap-2 bg-amber-50 border-t border-amber-200 text-amber-800" style={{ fontSize: '12px' }}>
              <AlertTriangle className="size-3.5 shrink-0 mt-0.5 text-amber-600" />
              <span>
                <strong>Разрыв счётчика:</strong> «начало» не совпадает с «концом» прошлой смены —{' '}
                {continuityMismatches.map(m => (
                  `колонка ${m.pump} (прошлый конец ${formatLiters(m.expected)}, введено ${formatLiters(m.entered)})`
                )).join('; ')}. Возможна опечатка или пропущенная смена — проверьте перед сохранением.
              </span>
            </div>
          )}
        </div>

        {/* Блок В — «ИЗ НИХ» (строки точно как на бумажном листе) */}
        <div className={sectionClass}>
          <div className={sectionHeaderClass}>
            <span className="size-5 rounded bg-blue-600 text-white flex items-center justify-center shrink-0" style={{ fontSize: '10px', fontWeight: 700 }}>В</span>
            <span className={sectionTitleClass} style={{ fontSize: '13px', fontWeight: 600 }}>ИЗ НИХ</span>
            <span className="text-slate-400" style={{ fontSize: '11px' }}>— вводятся только литры и Kaspi; цены 107/112 из настроек</span>
          </div>
          <div className={sectionBodyClass}>
            <div className="space-y-0.5">
              {/* Талоны (литр) — ввод */}
              {cashRowInput('voucherLiters', 'Талоны (литр)', voucherLiters, setVoucherLiters, 'л')}
              {/* Товарная карта (литр) — ввод */}
              {cashRowInput('cardLiters', 'Товарная карта (литр)', cardLiters, setCardLiters, 'л')}

              {/* Дисконтная карта по 107 тг — ввод литров + формула */}
              <div className="flex items-center justify-between gap-3 py-1.5 border-b border-[#edf0f5]">
                <Label htmlFor="discountLiters" className="text-slate-600 shrink-0" style={{ fontSize: '12px', fontWeight: 400 }}>
                  Дисконтная карта по {formatNumber(dPrice, 0)} тг
                </Label>
                <div className="flex flex-col items-end gap-0.5">
                  <div className="flex items-center gap-1.5">
                    <Input id="discountLiters" type="number" step="0.01" value={discountLiters}
                      onChange={e => setDiscountLiters(e.target.value)} placeholder="0.00"
                      className="h-8 w-28 font-mono border-[#d1d9e6] bg-[#f8fafc] text-right" style={{ fontSize: '13px' }} />
                    <span className="text-slate-400" style={{ fontSize: '12px' }}>л</span>
                  </div>
                  <span className="font-mono text-slate-400" style={{ fontSize: '11px' }}>
                    {formatNumber(parseFloat(discountLiters) || 0, 2)} л × {formatNumber(dPrice, 0)} ₸ = {formatCurrency(calculated.discountAmount)}
                  </span>
                </div>
              </div>

              {/* Остаток (литр) по 112 тг — расчёт */}
              {cashRowValue('Остаток (литр) по ' + formatNumber(bPrice, 0) + ' тг', formatLiters(calculated.remainderLiters))}

              {/* Общая сумма (тг) по 112 тг — расчёт + формула */}
              <div className="flex items-center justify-between gap-3 py-1.5 border-b border-[#edf0f5]">
                <span className="text-slate-600" style={{ fontSize: '12px' }}>Общая сумма (тг) по {formatNumber(bPrice, 0)} тг</span>
                <div className="flex flex-col items-end gap-0.5">
                  <span className="font-mono text-slate-800" style={{ fontSize: '13px', fontWeight: 500 }}>{formatCurrency(calculated.baseAmount)}</span>
                  <span className="font-mono text-slate-400" style={{ fontSize: '11px' }}>
                    {formatNumber(calculated.remainderLiters, 2)} л × {formatNumber(bPrice, 0)} ₸
                  </span>
                </div>
              </div>

              {/* Kaspi QR / перевод — ввод */}
              {cashRowInput('kaspiQR', 'Kaspi QR', kaspiQR, setKaspiQR, '₸')}
              {cashRowInput('kaspiTransfer', 'Kaspi перевод', kaspiTransfer, setKaspiTransfer, '₸')}

              {/* Наличные по 112 — расчёт (может быть отрицательным) */}
              <div className="flex items-center justify-between gap-3 py-1.5 border-b border-[#edf0f5]">
                <span className="text-slate-600" style={{ fontSize: '12px' }}>Наличные по {formatNumber(bPrice, 0)} тг</span>
                <span className={`font-mono ${calculated.cashByBase < 0 ? 'text-red-600' : 'text-slate-800'}`} style={{ fontSize: '13px', fontWeight: 500 }}>
                  {formatCurrency(calculated.cashByBase)}
                </span>
              </div>
              {/* Наличные по дисконтной карте по 107 — расчёт */}
              {cashRowValue('Наличные по дисконтной карте по ' + formatNumber(dPrice, 0) + ' тг', formatCurrency(calculated.cashByDiscount))}

              {/* ИТОГО НАЛИЧНЫМИ — расчёт, выделено */}
              <div className="flex justify-between items-center py-2.5 mt-1 border-t-2 border-[#d1d9e6]">
                <span className="text-slate-700" style={{ fontSize: '13px', fontWeight: 600 }}>ИТОГО НАЛИЧНЫМИ</span>
                <span className="font-mono text-blue-700" style={{ fontSize: '16px', fontWeight: 700 }}>{formatCurrency(calculated.totalCash)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Блок Г — Зарплата за смену (превью; бэк пересчитает при сохранении) */}
        <div className={sectionClass}>
          <div className={sectionHeaderClass}>
            <span className="size-5 rounded bg-blue-600 text-white flex items-center justify-center shrink-0" style={{ fontSize: '10px', fontWeight: 700 }}>Г</span>
            <span className={sectionTitleClass} style={{ fontSize: '13px', fontWeight: 600 }}>Зарплата за смену</span>
          </div>
          <div className={sectionBodyClass}>
            <div className="space-y-1 max-w-md">
              <div className="flex justify-between items-center py-1.5 border-b border-[#edf0f5]">
                <span className="text-slate-500" style={{ fontSize: '12px' }}>Ставка ({SHIFT_TYPE_LABELS[shiftType]})</span>
                <span className="font-mono text-slate-700" style={{ fontSize: '13px' }}>{formatCurrency(baseSalaryPreview)}</span>
              </div>
              <div className="flex justify-between items-center py-1.5 border-b border-[#edf0f5]">
                <span className="text-slate-500" style={{ fontSize: '12px' }}>Бонус за объём</span>
                <span className="font-mono text-slate-700" style={{ fontSize: '13px' }}>{formatCurrency(bonusPreview)}</span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-slate-700" style={{ fontSize: '13px', fontWeight: 600 }}>Итого за смену</span>
                <span className="font-mono text-emerald-700" style={{ fontSize: '15px', fontWeight: 700 }}>{formatCurrency(baseSalaryPreview + bonusPreview)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Submit */}
        {errors.submit && (
          <div className="px-4 py-2.5 flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg text-red-700" style={{ fontSize: '13px' }}>
            <AlertTriangle className="size-4 shrink-0" />
            {errors.submit}
          </div>
        )}
        <div className="flex items-center gap-3 pt-2">
          <Button type="submit" disabled={saving} className="gap-1.5 bg-blue-600 hover:bg-blue-700 text-white h-9 px-5 disabled:opacity-60" style={{ fontSize: '13px', fontWeight: 500 }}>
            <Save className="size-3.5" />
            {saving ? 'Сохранение…' : isEditing ? 'Сохранить изменения' : 'Создать смену'}
          </Button>
          <Button type="button" variant="outline" onClick={() => navigate('/')}
            className="h-9 px-5 border-[#d1d9e6] text-slate-600 hover:bg-[#f0f2f5]" style={{ fontSize: '13px' }}>
            Отмена
          </Button>
        </div>
      </form>
    </div>
  );
}
