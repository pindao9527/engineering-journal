import type { Command } from "commander";
import { analyzeJournalEvent } from "../analysis/analyze-event.js";
import { loadConfig } from "../config/load-config.js";
import { renderDaily } from "../journal/render.js";
import { overwriteJournalEvent, readJournalEventFiles } from "../storage/events.js";
import { readJournal, writeJournal } from "../storage/journals.js";
import { readTemplate } from "../storage/templates.js";
import { formatDate, parseDate } from "../time/format.js";

export interface AnalyzeDailyCommandOptions {
  date?: string;
  dryRun?: boolean;
}

export interface AnalyzeDailyResult {
  date: string;
  eventCount: number;
  updatedEventPaths: string[];
  journalPath?: string;
  dryRun: boolean;
  analyses: Array<{
    eventPath: string;
    analysis: unknown;
    tags: string[];
  }>;
}

export function registerAnalyzeCommand(program: Command): void {
  const analyze = program
    .command("analyze")
    .description("Run AI analysis for stored journal events.");

  analyze
    .command("daily")
    .description("Re-analyze a day's stored events and re-render the daily journal.")
    .option("--date <date>", "journal date in yyyy-MM-dd format")
    .option("--dry-run", "print the analysis that would be written without changing files")
    .action(async (options: AnalyzeDailyCommandOptions) => {
      const result = await runAnalyzeDaily(options);

      if (result.dryRun) {
        console.log(JSON.stringify(result, null, 2));
        return;
      }

      console.log(`events: ${result.updatedEventPaths.length}`);
      console.log(`journal: ${result.journalPath}`);
    });
}

export async function runAnalyzeDaily(options: AnalyzeDailyCommandOptions = {}): Promise<AnalyzeDailyResult> {
  const config = await loadConfig();
  const date = options.date ? parseDate(options.date) : new Date();
  const eventFiles = await readJournalEventFiles(config.journalRoot, date);

  if (eventFiles.length === 0) {
    throw new Error(`No events found for ${formatDate(date)}. Run englog daily first.`);
  }

  if (!config.analysis?.enabled) {
    throw new Error("AI analysis is disabled. Enable analysis in englog.config.json before running englog analyze daily.");
  }

  const analyzedFiles = [];
  for (const file of eventFiles) {
    const analyzed = await analyzeJournalEvent(file.event, config.analysis);
    analyzedFiles.push({
      path: file.path,
      event: {
        ...file.event,
        analysis: analyzed.analysis,
        tags: analyzed.tags
      }
    });
  }

  if (options.dryRun) {
    return {
      date: formatDate(date),
      eventCount: eventFiles.length,
      updatedEventPaths: [],
      dryRun: true,
      analyses: analyzedFiles.map((file) => ({
        eventPath: file.path,
        analysis: file.event.analysis,
        tags: file.event.tags
      }))
    };
  }

  await Promise.all(analyzedFiles.map((file) => overwriteJournalEvent(file.path, file.event)));
  const existingMarkdown = await readJournal(config.journalRoot, "daily", date);
  const templateMarkdown = existingMarkdown ? undefined : await readTemplate(config.journalRoot, "daily.md");
  const journalPath = await writeJournal(
    config.journalRoot,
    "daily",
    date,
    renderDaily({
      date: formatDate(date),
      events: analyzedFiles.map((file) => file.event),
      existingMarkdown,
      templateMarkdown
    })
  );

  return {
    date: formatDate(date),
    eventCount: eventFiles.length,
    updatedEventPaths: analyzedFiles.map((file) => file.path),
    journalPath,
    dryRun: false,
    analyses: []
  };
}
