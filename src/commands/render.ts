import type { Command } from "commander";
import { loadConfig } from "../config/load-config.js";
import { renderDaily } from "../journal/render.js";
import { readJournalEvents } from "../storage/events.js";
import { readJournal, writeJournal } from "../storage/journals.js";
import { readTemplate } from "../storage/templates.js";
import { formatDate, parseDate } from "../time/format.js";
import { resolvePeriod, runPeriodSummary } from "./periodic.js";

export interface RenderCommandOptions {
  date?: string;
  week?: string;
  month?: string;
  quarter?: string;
  period?: string;
  year?: string;
}

export function registerRenderCommand(program: Command): void {
  const render = program
    .command("render")
    .description("Render journal Markdown from stored event data.");

  render
    .command("daily")
    .description("Re-render a daily journal while preserving manual sections.")
    .option("--date <date>", "journal date in yyyy-MM-dd format")
    .action(async (options: RenderCommandOptions) => {
      const journalPath = await runRenderDaily(options);
      console.log(`journal: ${journalPath}`);
    });

  render
    .command("weekly")
    .description("Re-render a weekly summary while preserving manual sections.")
    .option("--week <week>", "ISO week in yyyy-Www format")
    .action(async (options: RenderCommandOptions) => {
      console.log(`journal: ${await runPeriodSummary(resolvePeriod("weekly", options))}`);
    });

  render
    .command("monthly")
    .description("Re-render a monthly summary while preserving manual sections.")
    .option("--month <month>", "month in yyyy-MM format")
    .action(async (options: RenderCommandOptions) => {
      console.log(`journal: ${await runPeriodSummary(resolvePeriod("monthly", options))}`);
    });

  render
    .command("quarterly")
    .description("Re-render a quarterly summary while preserving manual sections.")
    .option("--quarter <quarter>", "quarter in yyyy-Qn format")
    .action(async (options: RenderCommandOptions) => {
      console.log(`journal: ${await runPeriodSummary(resolvePeriod("quarterly", options))}`);
    });

  render
    .command("half-year")
    .description("Re-render a half-year summary while preserving manual sections.")
    .option("--period <period>", "half-year period in yyyy-Hn format")
    .action(async (options: RenderCommandOptions) => {
      console.log(`journal: ${await runPeriodSummary(resolvePeriod("half-year", options))}`);
    });

  render
    .command("yearly")
    .description("Re-render a yearly summary while preserving manual sections.")
    .option("--year <year>", "year in yyyy format")
    .action(async (options: RenderCommandOptions) => {
      console.log(`journal: ${await runPeriodSummary(resolvePeriod("yearly", options))}`);
    });
}

export async function runRenderDaily(options: RenderCommandOptions = {}): Promise<string> {
  const config = await loadConfig();
  const date = options.date ? parseDate(options.date) : new Date();
  const existingMarkdown = await readJournal(config.journalRoot, "daily", date);
  const templateMarkdown = existingMarkdown ? undefined : await readTemplate(config.journalRoot, "daily.md");
  const events = await readJournalEvents(config.journalRoot, date);

  return writeJournal(
    config.journalRoot,
    "daily",
    date,
    renderDaily({
      date: formatDate(date),
      events,
      existingMarkdown,
      templateMarkdown
    })
  );
}
