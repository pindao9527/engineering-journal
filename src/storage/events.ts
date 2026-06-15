import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { CommitSummary } from "../git/commits.js";
import type { RepoInfo } from "../git/repo.js";
import { formatCompactDateTime, formatDate } from "../time/format.js";

export interface JournalEvent {
  schemaVersion: 1;
  id: string;
  date: string;
  createdAt: string;
  device: string;
  repo?: string;
  repoPath?: string;
  branch?: string;
  author?: string;
  commits: CommitSummary[];
  changedFiles: string[];
  diffStats: {
    filesChanged: number;
    insertions: number;
    deletions: number;
  };
  diffCollection?: DiffCollectionMetadata;
  analysis: JournalAnalysis;
  tags: string[];
}

export interface DiffCollectionMetadata {
  enabled: boolean;
  maxDiffChars: number;
  maxFileDiffChars: number;
  excludedFiles: string[];
  truncated: boolean;
}

export interface JournalAnalysis {
  summary: string[];
  valuableChanges: string[];
  technicalHighlights: string[];
  decisions: string[];
  risks: string[];
  tests: string[];
  aiAssistedParts: string[];
  humanReviewNotes: string[];
}

export interface JournalEventFile {
  path: string;
  event: JournalEvent;
}

export function eventDirectory(root: string, date: Date): string {
  return path.join(root, "data", "events", formatDate(date));
}

export function createJournalEvent(input: {
  date: Date;
  repo?: RepoInfo;
  commits: CommitSummary[];
  device?: string;
  now?: Date;
  diffCollection?: DiffCollectionMetadata;
}): JournalEvent {
  const now = input.now ?? new Date();
  const device = sanitizeIdPart(input.device ?? os.hostname());
  const changedFiles = unique(input.commits.flatMap((commit) => commit.changedFiles));

  return {
    schemaVersion: 1,
    id: `${device}-${formatCompactDateTime(now)}`,
    date: formatDate(input.date),
    createdAt: now.toISOString(),
    device,
    repo: input.repo?.name,
    repoPath: input.repo?.path,
    branch: input.repo?.branch,
    author: input.repo?.author,
    commits: input.commits,
    changedFiles,
    diffStats: {
      filesChanged: changedFiles.length,
      insertions: sum(input.commits.map((commit) => commit.insertions)),
      deletions: sum(input.commits.map((commit) => commit.deletions))
    },
    diffCollection: input.diffCollection,
    analysis: {
      summary: input.commits.map((commit) => commit.message),
      valuableChanges: [],
      technicalHighlights: [],
      decisions: [],
      risks: [],
      tests: inferTests(changedFiles),
      aiAssistedParts: [],
      humanReviewNotes: []
    },
    tags: []
  };
}

export async function writeJournalEvent(root: string, event: JournalEvent): Promise<string> {
  const directory = path.join(root, "data", "events", event.date);
  await mkdir(directory, { recursive: true });

  let eventPath = path.join(directory, `${event.id}.json`);
  let suffix = 1;

  while (await pathExists(eventPath)) {
    eventPath = path.join(directory, `${event.id}-${suffix}.json`);
    suffix += 1;
  }

  await writeFile(eventPath, `${JSON.stringify(event, null, 2)}\n`, "utf8");
  return eventPath;
}

export async function readJournalEvents(root: string, date: Date): Promise<JournalEvent[]> {
  return (await readJournalEventFiles(root, date)).map((file) => file.event);
}

export async function readAllJournalEventFiles(root: string): Promise<JournalEventFile[]> {
  const rootDirectory = path.join(root, "data", "events");

  try {
    const dateDirectories = await readdir(rootDirectory, { withFileTypes: true });
    const eventFiles = await Promise.all(
      dateDirectories
        .filter((entry) => entry.isDirectory())
        .sort((a, b) => a.name.localeCompare(b.name))
        .map(async (entry) => {
          const date = new Date(`${entry.name}T00:00:00`);
          if (Number.isNaN(date.getTime())) {
            return [];
          }
          return readJournalEventFiles(root, date);
        })
    );

    return eventFiles.flat();
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

export async function readJournalEventFiles(root: string, date: Date): Promise<JournalEventFile[]> {
  const directory = eventDirectory(root, date);

  try {
    const entries = await readdir(directory, { withFileTypes: true });
    const files = await Promise.all(
      entries
        .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
        .sort((a, b) => a.name.localeCompare(b.name))
        .map(async (entry) => {
          const eventPath = path.join(directory, entry.name);
          return {
            path: eventPath,
            event: JSON.parse(await readFile(eventPath, "utf8")) as JournalEvent
          };
        })
    );

    return files.filter((file) => file.event.schemaVersion === 1);
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

export async function overwriteJournalEvent(filePath: string, event: JournalEvent): Promise<void> {
  await writeFile(filePath, `${JSON.stringify(event, null, 2)}\n`, "utf8");
}

function inferTests(files: string[]): string[] {
  const testFiles = files.filter((file) => /(^|[/\\])(__tests__|test|tests)([/\\]|$)|\.(test|spec)\./i.test(file));

  if (testFiles.length === 0) {
    return ["未检测到测试文件变化。"];
  }

  return [`检测到测试相关文件变化：${testFiles.join(", ")}`];
}

function sanitizeIdPart(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "") || "device";
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

function unique(values: string[]): string[] {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await readFile(filePath, "utf8");
    return true;
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") {
      return false;
    }
    throw error;
  }
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}
