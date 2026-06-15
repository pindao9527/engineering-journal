import {
  addDays,
  endOfDay,
  endOfMonth,
  format,
  getISOWeek,
  getISOWeekYear,
  getQuarter,
  isMatch,
  parse,
  startOfDay,
  startOfISOWeek
} from "date-fns";

export interface TimeRange {
  start: Date;
  end: Date;
}

export function dailyRange(date: Date): TimeRange {
  return {
    start: startOfDay(date),
    end: endOfDay(date)
  };
}

export type SummaryPeriod = "weekly" | "monthly" | "quarterly" | "half-year" | "yearly";

export interface PeriodDescriptor {
  period: SummaryPeriod;
  key: string;
  label: string;
  start: Date;
  end: Date;
  sourcePeriod: "daily" | SummaryPeriod;
  sourceKeys: string[];
  missingHint: string;
}

export function currentWeekKey(date = new Date()): string {
  return `${getISOWeekYear(date)}-W${String(getISOWeek(date)).padStart(2, "0")}`;
}

export function currentMonthKey(date = new Date()): string {
  return format(date, "yyyy-MM");
}

export function currentQuarterKey(date = new Date()): string {
  return `${format(date, "yyyy")}-Q${getQuarter(date)}`;
}

export function currentHalfYearKey(date = new Date()): string {
  return `${format(date, "yyyy")}-H${getQuarter(date) <= 2 ? "1" : "2"}`;
}

export function currentYearKey(date = new Date()): string {
  return format(date, "yyyy");
}

export function parseWeekKey(value: string): PeriodDescriptor {
  const match = /^(\d{4})-W(\d{2})$/.exec(value);
  if (!match) {
    throw new Error(`Invalid week: ${value}. Expected yyyy-Www, for example 2026-W25.`);
  }

  const year = Number(match[1]);
  const week = Number(match[2]);
  if (week < 1 || week > 53) {
    throw new Error(`Invalid week: ${value}. Week must be between 01 and 53.`);
  }

  const jan4 = new Date(year, 0, 4);
  const start = addDays(startOfISOWeek(jan4), (week - 1) * 7);
  const end = addDays(start, 6);
  const sourceKeys = Array.from({ length: 7 }, (_, index) => format(addDays(start, index), "yyyy-MM-dd"));

  return {
    period: "weekly",
    key: value,
    label: value,
    start,
    end,
    sourcePeriod: "daily",
    sourceKeys,
    missingHint: "run englog daily for the missing dates first"
  };
}

export function parseMonthKey(value: string): PeriodDescriptor {
  if (!isMatch(value, "yyyy-MM")) {
    throw new Error(`Invalid month: ${value}. Expected yyyy-MM, for example 2026-06.`);
  }

  const start = parse(value, "yyyy-MM", new Date());
  const end = endOfMonth(start);

  return {
    period: "monthly",
    key: value,
    label: value,
    start,
    end,
    sourcePeriod: "weekly",
    sourceKeys: weeklyKeysBetween(start, end),
    missingHint: "run englog weekly for the missing weeks first"
  };
}

export function parseQuarterKey(value: string): PeriodDescriptor {
  const match = /^(\d{4})-Q([1-4])$/.exec(value);
  if (!match) {
    throw new Error(`Invalid quarter: ${value}. Expected yyyy-Qn, for example 2026-Q2.`);
  }

  const year = Number(match[1]);
  const quarter = Number(match[2]);
  const start = new Date(year, (quarter - 1) * 3, 1);
  const end = endOfMonth(new Date(year, quarter * 3 - 1, 1));

  return {
    period: "quarterly",
    key: value,
    label: value,
    start,
    end,
    sourcePeriod: "monthly",
    sourceKeys: Array.from({ length: 3 }, (_, index) => format(new Date(year, (quarter - 1) * 3 + index, 1), "yyyy-MM")),
    missingHint: "run englog monthly for the missing months first"
  };
}

export function parseHalfYearKey(value: string): PeriodDescriptor {
  const match = /^(\d{4})-H([12])$/.exec(value);
  if (!match) {
    throw new Error(`Invalid half-year period: ${value}. Expected yyyy-Hn, for example 2026-H1.`);
  }

  const year = Number(match[1]);
  const half = Number(match[2]);
  const startMonth = half === 1 ? 0 : 6;
  const start = new Date(year, startMonth, 1);
  const end = endOfMonth(new Date(year, startMonth + 5, 1));

  return {
    period: "half-year",
    key: value,
    label: value,
    start,
    end,
    sourcePeriod: "quarterly",
    sourceKeys: half === 1 ? [`${year}-Q1`, `${year}-Q2`] : [`${year}-Q3`, `${year}-Q4`],
    missingHint: "run englog quarterly for the missing quarters first"
  };
}

export function parseYearKey(value: string): PeriodDescriptor {
  if (!/^\d{4}$/.test(value)) {
    throw new Error(`Invalid year: ${value}. Expected yyyy, for example 2026.`);
  }

  const year = Number(value);

  return {
    period: "yearly",
    key: value,
    label: value,
    start: new Date(year, 0, 1),
    end: new Date(year, 11, 31),
    sourcePeriod: "half-year",
    sourceKeys: [`${year}-H1`, `${year}-H2`],
    missingHint: "run englog half-year for the missing half-year summaries first"
  };
}

function weeklyKeysBetween(start: Date, end: Date): string[] {
  const keys: string[] = [];
  let cursor = startOfISOWeek(start);

  while (cursor <= end) {
    keys.push(currentWeekKey(cursor));
    cursor = addDays(cursor, 7);
  }

  return keys;
}
