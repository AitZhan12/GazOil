import { useEffect, useState } from 'react';
import { Activity, AlertTriangle } from 'lucide-react';
import { getAuditEvents } from '../lib/storage';
import { AuditEvent } from '../types';

const ACTION_LABELS: Record<string, string> = {
  CREATE: 'Создание',
  UPDATE: 'Изменение',
  DELETE: 'Удаление',
  CASH_COLLECTED: 'Инкассация',
  CASH_COLLECTION_REOPENED: 'Отмена инкассации',
};

export function AuditJournal() {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    getAuditEvents().then(setEvents).catch(e => setError(e instanceof Error ? e.message : 'Не удалось загрузить журнал'));
  }, []);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-slate-900" style={{ fontSize: '18px', fontWeight: 600 }}>Журнал действий</h1>
        <p className="text-slate-500 mt-0.5" style={{ fontSize: '12px' }}>Кто, когда и что изменил</p>
      </div>
      {error && <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-700" style={{ fontSize: '13px' }}><AlertTriangle className="size-4" />{error}</div>}
      {!error && events.length === 0 && <div className="rounded-lg border border-[#d1d9e6] bg-white p-10 text-center text-slate-500" style={{ fontSize: '14px' }}>Действий пока нет</div>}
      {events.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-[#d1d9e6] bg-white">
          <table className="w-full min-w-[850px] border-collapse">
            <thead className="bg-[#f8fafc]">
              <tr>
                {['Дата и время', 'Пользователь', 'Действие', 'Оператор', 'Станция', 'Подробности'].map(label => <th key={label} className="border-b border-[#d1d9e6] px-4 py-3 text-left text-slate-500" style={{ fontSize: '11px', fontWeight: 600 }}>{label}</th>)}
              </tr>
            </thead>
            <tbody>
              {events.map(event => (
                <tr key={event.id} className="border-b border-[#edf0f5] last:border-0 hover:bg-[#f8fafc]">
                  <td className="px-4 py-3 font-mono text-slate-700" style={{ fontSize: '12px' }}>{new Date(event.occurredAt).toLocaleString('ru-RU')}</td>
                  <td className="px-4 py-3 text-slate-800" style={{ fontSize: '13px' }}>{event.actorUsername}</td>
                  <td className="px-4 py-3" style={{ fontSize: '13px' }}><span className="inline-flex items-center gap-1.5 text-blue-700"><Activity className="size-3.5" />{ACTION_LABELS[event.action] ?? event.action}</span></td>
                  <td className="px-4 py-3 text-slate-700" style={{ fontSize: '13px' }}>{event.operatorName ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-700" style={{ fontSize: '13px' }}>{event.stationName}</td>
                  <td className="px-4 py-3 text-slate-500" style={{ fontSize: '12px' }}>{event.details ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
