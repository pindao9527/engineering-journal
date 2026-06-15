import { endOfDay, startOfDay } from "date-fns";

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
