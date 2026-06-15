import path from "node:path";
import { formatDate } from "../time/format.js";

export type JournalPeriod =
  | "daily"
  | "weekly"
  | "monthly"
  | "quarterly"
  | "half-year"
  | "yearly";

export function journalPath(root: string, period: JournalPeriod, date: Date): string {
  return path.join(root, "journals", period, `${formatDate(date)}.md`);
}
