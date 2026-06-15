import path from "node:path";
import { formatDate } from "../time/format.js";

export interface JournalEvent {
  schemaVersion: 1;
  id: string;
  date: string;
  repo?: string;
  branch?: string;
  commits: unknown[];
  changedFiles: string[];
  diffStats: {
    filesChanged: number;
    insertions: number;
    deletions: number;
  };
}

export function eventDirectory(root: string, date: Date): string {
  return path.join(root, "data", "events", formatDate(date));
}
