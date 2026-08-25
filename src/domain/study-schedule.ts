import { Weekday } from './models';

const DAY_INDEX: Record<Weekday, number> = {
  SUNDAY: 0,
  MONDAY: 1,
  TUESDAY: 2,
  WEDNESDAY: 3,
  THURSDAY: 4,
  FRIDAY: 5,
  SATURDAY: 6,
};

/** Assigns roadmap items to the next configured UTC study days, including startDate. */
export function calculateStudyDates(startDate: Date, days: Weekday[], count: number): string[] {
  if (!days.length) throw new Error('At least one preferred study day is required');
  const allowed = new Set(days.map((day) => DAY_INDEX[day]));
  const cursor = new Date(startDate);
  cursor.setUTCHours(12, 0, 0, 0);
  const dates: string[] = [];
  while (dates.length < count) {
    if (allowed.has(cursor.getUTCDay())) dates.push(cursor.toISOString());
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}
