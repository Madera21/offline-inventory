import { getReportDateRange } from '../src/utils/reportDates';
import { getDayStartAndEndIso } from '../src/utils/dates';

const now = new Date(2026, 0, 1, 15, 30);
const day = new Date(2025, 11, 20);
test('yesterday crosses the year boundary using the complete local day', () => {
  expect(getReportDateRange('YESTERDAY', day, day, day, now)).toEqual(getDayStartAndEndIso(new Date(2025, 11, 31)));
});
test.each([['WEEK', 7], ['THIRTY_DAYS', 30]] as const)('%s preserves a rolling interval', (period, days) => {
  expect(getReportDateRange(period, day, day, day, now)).toEqual({ start: new Date(now.getTime() - days * 86400000).toISOString(), end: now.toISOString() });
});
test('today and this month begin at local midnight, while all time has no bounds', () => {
  expect(getReportDateRange('TODAY', day, day, day, now)).toEqual({ start: getDayStartAndEndIso(now).start, end: now.toISOString() });
  expect(getReportDateRange('MONTH', day, day, day, now).start).toBe(new Date(2026, 0, 1).toISOString());
  expect(getReportDateRange('ALL', day, day, day, now)).toEqual({});
});
test('custom ranges include the complete last day and reject reversed dates', () => {
  const end = new Date(2025, 11, 31);
  expect(getReportDateRange('CUSTOM', day, day, end, now)).toEqual({ start: getDayStartAndEndIso(day).start, end: getDayStartAndEndIso(end).end });
  expect(getReportDateRange('CUSTOM', day, day, day, now)).toEqual(getDayStartAndEndIso(day));
  expect(() => getReportDateRange('CUSTOM', day, end, day, now)).toThrow('End date');
});
