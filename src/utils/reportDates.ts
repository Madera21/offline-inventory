import { getDayStartAndEndIso } from './dates';

export type ReportPeriod = 'TODAY' | 'YESTERDAY' | 'WEEK' | 'MONTH' | 'THIRTY_DAYS' | 'ALL' | 'DAY' | 'CUSTOM';
export interface ReportDateRange { start?: string; end?: string }
export const reportPeriodLabels: Record<ReportPeriod, string> = {
  TODAY: 'Today', YESTERDAY: 'Yesterday', WEEK: '7 Days', MONTH: 'This Month',
  THIRTY_DAYS: 'Last 30 Days', ALL: 'All Time', DAY: 'Choose a day', CUSTOM: 'Custom range',
};

export function getReportDateRange(period: ReportPeriod, day: Date, from: Date, to: Date, now = new Date()): ReportDateRange {
  if (period === 'ALL') return {};
  if (period === 'DAY') return getDayStartAndEndIso(day);
  if (period === 'CUSTOM') {
    const start = getDayStartAndEndIso(from).start;
    const end = getDayStartAndEndIso(to).end;
    if (start > end) throw new Error('End date must be on or after the start date.');
    return { start, end };
  }
  if (period === 'YESTERDAY') return getDayStartAndEndIso(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1));
  if (period === 'TODAY') return { start: getDayStartAndEndIso(now).start, end: now.toISOString() };
  if (period === 'MONTH') return { start: new Date(now.getFullYear(), now.getMonth(), 1).toISOString(), end: now.toISOString() };
  const days = period === 'WEEK' ? 7 : 30;
  return { start: new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString(), end: now.toISOString() };
}

export function formatReportRange(range: ReportDateRange): string {
  if (!range.start || !range.end) return 'All Time';
  const start = new Date(range.start);
  const end = new Date(range.end);
  const format = (date: Date) => date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  return start.toDateString() === end.toDateString() ? format(start) : `${format(start)} – ${format(end)}`;
}
