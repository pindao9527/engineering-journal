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

export function journalPathForKey(root: string, period: JournalPeriod, key: string): string {
  return path.join(root, "journals", period, `${key}.md`);
}

export async function readJournal(root: string, period: JournalPeriod, date: Date): Promise<string | undefined> {
  return readJournalByKey(root, period, formatDate(date));
}

export async function readJournalByKey(
  root: string,
  period: JournalPeriod,
  key: string
): Promise<string | undefined> {
  return readMarkdown(journalPathForKey(root, period, key));
}

export async function writeJournal(root: string, period: JournalPeriod, date: Date, markdown: string): Promise<string> {
  return writeJournalByKey(root, period, formatDate(date), markdown);
}

export async function writeJournalByKey(
  root: string,
  period: JournalPeriod,
  key: string,
  markdown: string
): Promise<string> {
  const filePath = journalPathForKey(root, period, key);
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, markdown, "utf8");
  return filePath;
}

async function readMarkdown(filePath: string): Promise<string | undefined> {
  try {
    return await readFile(filePath, "utf8");
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") {
      return undefined;
    }
    throw error;
  }
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}
