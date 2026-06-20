import { getShifts } from './storage';
import { PumpReading } from '../types';

const EMPTY_READINGS: PumpReading[] = [
  { pumpNumber: 1, start: 0, end: 0, volume: 0 },
  { pumpNumber: 2, start: 0, end: 0, volume: 0 },
  { pumpNumber: 3, start: 0, end: 0, volume: 0 },
];

export async function getLastPumpReadings(): Promise<PumpReading[]> {
  const shifts = await getShifts();
  if (shifts.length === 0) {
    return EMPTY_READINGS;
  }

  // Sort by date/time descending
  const sorted = [...shifts].sort((a, b) => {
    return `${b.endDate} ${b.endTime}`.localeCompare(`${a.endDate} ${a.endTime}`);
  });

  const lastShift = sorted[0];
  return lastShift.pumps && lastShift.pumps.length > 0 ? lastShift.pumps : EMPTY_READINGS;
}
