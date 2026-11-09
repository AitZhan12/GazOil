import { getShifts } from './storage';
import { PumpReading } from '../types';
import { getCurrentUser } from './auth';

function emptyReadings(): PumpReading[] {
  return Array.from({ length: getCurrentUser().pumpCount }, (_, index) => ({
    pumpNumber: index + 1, start: 0, end: 0, volume: 0,
    discountLiters: 0, discountPrice: 0, regularPrice: 0,
  }));
}

export async function getLastPumpReadings(): Promise<PumpReading[]> {
  const shifts = await getShifts();
  if (shifts.length === 0) {
    return emptyReadings();
  }

  // Sort by date/time descending
  const sorted = [...shifts].sort((a, b) => {
    return `${b.endDate} ${b.endTime}`.localeCompare(`${a.endDate} ${a.endTime}`);
  });

  const lastShift = sorted[0];
  return lastShift.pumps && lastShift.pumps.length > 0 ? lastShift.pumps : EMPTY_READINGS;
}
