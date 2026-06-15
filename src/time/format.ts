import { format, parseISO } from "date-fns";

export const DATE_FORMAT = "yyyy-MM-dd";
export const COMPACT_DATE_TIME_FORMAT = "yyyyMMdd-HHmmss";

export function formatDate(date: Date): string {
  return format(date, DATE_FORMAT);
}

export function formatCompactDateTime(date: Date): string {
  return format(date, COMPACT_DATE_TIME_FORMAT);
}

export function parseDate(value: string): Date {
  const parsed = parseISO(value);

  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid date: ${value}`);
  }

  return parsed;
}
