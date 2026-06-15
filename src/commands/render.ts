import type { Command } from "commander";
import { loadConfig } from "../config/load-config.js";
import { renderDaily } from "../journal/render.js";
import { readJournalEvents } from "../storage/events.js";
import { readJournal, writeJournal } from "../storage/journals.js";
import { readTemplate } from "../storage/templates.js";
import { formatDate, parseDate } from "../time/format.js";

export interface RenderCommandOptions {
  date?: string;
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
