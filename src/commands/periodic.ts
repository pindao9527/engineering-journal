import type { Command } from "commander";
import { loadConfig } from "../config/load-config.js";
import { renderPeriodSummary } from "../journal/render.js";
import { readJournalByKey, writeJournalByKey } from "../storage/journals.js";
import { readTemplate } from "../storage/templates.js";
import {
  currentHalfYearKey,
  currentMonthKey,
  currentQuarterKey,
  currentWeekKey,
  currentYearKey,
  parseHalfYearKey,
  parseMonthKey,
  parseQuarterKey,
  parseWeekKey,
  parseYearKey,
  type PeriodDescriptor,
  type SummaryPeriod
} from "../time/periods.js";

type PeriodOptions = {
  week?: string;
  month?: string;
  quarter?: string;
  period?: string;
  year?: string;
};

export function registerPeriodicCommands(program: Command): void {
  program
    .command("weekly")
    .description("Generate a weekly summary from daily journals.")
    .option("--week <week>", "ISO week in yyyy-Www format")
    .action(async (options: PeriodOptions) => {
      console.log(`journal: ${await runPeriodSummary(resolveWeekly(options))}`);
    });

  program
    .command("monthly")
    .description("Generate a monthly summary from weekly journals.")
    .option("--month <month>", "month in yyyy-MM format")
    .action(async (options: PeriodOptions) => {
      console.log(`journal: ${await runPeriodSummary(resolveMonthly(options))}`);
    });

  program
    .command("quarterly")
    .description("Generate a quarterly summary from monthly journals.")
    .option("--quarter <quarter>", "quarter in yyyy-Qn format")
    .action(async (options: PeriodOptions) => {
      console.log(`journal: ${await runPeriodSummary(resolveQuarterly(options))}`);
    });

  program
    .command("half-year")
    .description("Generate a half-year summary from quarterly journals.")
    .option("--period <period>", "half-year period in yyyy-Hn format")
    .action(async (options: PeriodOptions) => {
      console.log(`journal: ${await runPeriodSummary(resolveHalfYear(options))}`);
    });

  program
    .command("yearly")
    .description("Generate a yearly summary from half-year journals.")
    .option("--year <year>", "year in yyyy format")
    .action(async (options: PeriodOptions) => {
      console.log(`journal: ${await runPeriodSummary(resolveYearly(options))}`);
    });
}

export async function runPeriodSummary(descriptor: PeriodDescriptor): Promise<string> {
  const config = await loadConfig();
  const sourceEntries = await Promise.all(
    descriptor.sourceKeys.map(async (key) => ({
      key,
      markdown: await readJournalByKey(config.journalRoot, descriptor.sourcePeriod, key)
    }))
  );
  const sources = sourceEntries.flatMap((entry) => (entry.markdown ? [{ key: entry.key, markdown: entry.markdown }] : []));
  const missingSourceKeys = sourceEntries.filter((entry) => !entry.markdown).map((entry) => entry.key);
  const existingMarkdown = await readJournalByKey(config.journalRoot, descriptor.period, descriptor.key);
  const templateMarkdown = existingMarkdown
    ? undefined
    : await readJournalTemplate(config.journalRoot, descriptor.period);

  return writeJournalByKey(
    config.journalRoot,
    descriptor.period,
    descriptor.key,
    renderPeriodSummary({
      period: descriptor.period,
      key: descriptor.key,
      label: descriptor.label,
      sourcePeriod: descriptor.sourcePeriod,
      sources,
      missingSourceKeys,
      missingHint: descriptor.missingHint,
      existingMarkdown,
      templateMarkdown
    })
  );
}

export function resolvePeriod(period: SummaryPeriod, options: PeriodOptions = {}): PeriodDescriptor {
  switch (period) {
    case "weekly":
      return resolveWeekly(options);
    case "monthly":
      return resolveMonthly(options);
    case "quarterly":
      return resolveQuarterly(options);
    case "half-year":
      return resolveHalfYear(options);
    case "yearly":
      return resolveYearly(options);
  }
}

function resolveWeekly(options: PeriodOptions): PeriodDescriptor {
  return parseWeekKey(options.week ?? currentWeekKey());
}

function resolveMonthly(options: PeriodOptions): PeriodDescriptor {
  return parseMonthKey(options.month ?? currentMonthKey());
}

function resolveQuarterly(options: PeriodOptions): PeriodDescriptor {
  return parseQuarterKey(options.quarter ?? currentQuarterKey());
}

function resolveHalfYear(options: PeriodOptions): PeriodDescriptor {
  return parseHalfYearKey(options.period ?? currentHalfYearKey());
}

function resolveYearly(options: PeriodOptions): PeriodDescriptor {
  return parseYearKey(options.year ?? currentYearKey());
}

async function readJournalTemplate(root: string, period: SummaryPeriod): Promise<string | undefined> {
  return readTemplate(root, `${period}.md`);
}
