import { mkdir, readFile, writeFile } from "node:fs/promises";
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

export async function readJournal(root: string, period: JournalPeriod, date: Date): Promise<string | undefined> {
  try {
    return await readFile(journalPath(root, period, date), "utf8");
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") {
      return undefined;
    }
    throw error;
  }
}

export async function writeJournal(root: string, period: JournalPeriod, date: Date, markdown: string): Promise<string> {
  const filePath = journalPath(root, period, date);
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, markdown, "utf8");
  return filePath;
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}
