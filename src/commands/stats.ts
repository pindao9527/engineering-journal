import type { Command } from "commander";
import { loadConfig } from "../config/load-config.js";
import { readAllJournalEventFiles, type JournalEvent } from "../storage/events.js";

export interface StatsCommandOptions {
  month?: string;
  tag?: string;
}

export function registerStatsCommand(program: Command): void {
  program
    .command("stats")
    .description("Show project, tag, and time statistics from journal events.")
    .option("--month <month>", "month in yyyy-MM format")
    .option("--tag <tag>", "only include events with this tag")
    .action(async (options: StatsCommandOptions) => {
      console.log(await runStats(options));
    });
}

export async function runStats(options: StatsCommandOptions = {}): Promise<string> {
  const config = await loadConfig();
  const normalizedTag = options.tag?.toLowerCase();
  const events = (await readAllJournalEventFiles(config.journalRoot))
    .map((file) => file.event)
    .filter((event) => (options.month ? event.date.startsWith(`${options.month}-`) : true))
    .filter((event) => (normalizedTag ? event.tags.some((tag) => tag.toLowerCase() === normalizedTag) : true));

  const uniqueFiles = new Set(events.flatMap((event) => event.changedFiles));
  const tagCounts = countValues(events.flatMap((event) => event.tags));
  const projectCounts = countValues(events.map((event) => event.repo ?? "unknown"));
  const riskCount = events.reduce((total, event) => total + event.analysis.risks.length, 0);
  const testSignals = events.reduce((total, event) => total + event.analysis.tests.length, 0);
  const commitCount = events.reduce((total, event) => total + event.commits.length, 0);
  const insertions = events.reduce((total, event) => total + event.diffStats.insertions, 0);
  const deletions = events.reduce((total, event) => total + event.diffStats.deletions, 0);

  return [
    `scope: ${formatScope(options)}`,
    `events: ${events.length}`,
    `commits: ${commitCount}`,
    `changed files: ${uniqueFiles.size}`,
    `insertions: ${insertions}`,
    `deletions: ${deletions}`,
    `test signals: ${testSignals}`,
    `risk notes: ${riskCount}`,
    `top tags: ${formatTopCounts(tagCounts)}`,
    `top projects: ${formatTopCounts(projectCounts)}`,
    `active dates: ${formatActiveDates(events)}`
  ].join("\n");
}

function formatScope(options: StatsCommandOptions): string {
  const scope = [];
  if (options.month) {
    scope.push(`month=${options.month}`);
  }
  if (options.tag) {
    scope.push(`tag=${options.tag}`);
  }
  return scope.length > 0 ? scope.join(" ") : "all";
}

function countValues(values: string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return counts;
}

function formatTopCounts(counts: Map<string, number>): string {
  const entries = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 5);
  return entries.length > 0 ? entries.map(([value, count]) => `${value}(${count})`).join(", ") : "none";
}

function formatActiveDates(events: JournalEvent[]): string {
  const dates = [...new Set(events.map((event) => event.date))].sort((a, b) => a.localeCompare(b));
  return dates.length > 0 ? dates.join(", ") : "none";
}
