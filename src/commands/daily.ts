import type { Command } from "commander";
import { analyzeEventWithOpenAICompatibleApi } from "../analysis/openai-compatible.js";
import { loadConfig } from "../config/load-config.js";
import { listCommits } from "../git/commits.js";
import { getRepoInfo } from "../git/repo.js";
import { commitJournalChanges, ensureCleanWorktree, pullJournalRepo, pushJournalRepo } from "../git/sync.js";
import { renderDaily } from "../journal/render.js";
import { createJournalEvent, readJournalEvents, writeJournalEvent } from "../storage/events.js";
import { readJournal, writeJournal } from "../storage/journals.js";
import { readTemplate } from "../storage/templates.js";
import { formatDate, parseDate } from "../time/format.js";
import { dailyRange } from "../time/periods.js";

export interface DailyCommandOptions {
  date?: string;
  repo?: string;
  git: boolean;
  sync?: boolean;
}

export function registerDailyCommand(program: Command): void {
  program
    .command("daily")
    .description("Collect today's Git activity and render a daily journal.")
    .option("--date <date>", "journal date in yyyy-MM-dd format")
    .option("--repo <path>", "Git repository path to inspect")
    .option("--no-git", "skip Git collection and render an empty journal")
    .option("--sync", "pull, collect, render, commit, and push when supported")
    .action(async (options: DailyCommandOptions) => {
      if (options.sync) {
        const result = await runDailySync(options);
        console.log(`event: ${result.eventPath}`);
        console.log(`journal: ${result.journalPath}`);
        console.log(`commit: ${result.committed ? "created" : "skipped"}`);
        console.log("push: done");
        return;
      }

      const result = await runDaily(options);
      console.log(`event: ${result.eventPath}`);
      console.log(`journal: ${result.journalPath}`);
    });
}

export async function runDaily(options: Partial<DailyCommandOptions> = {}): Promise<{
  eventPath: string;
  journalPath: string;
}> {
  const config = await loadConfig();
  const date = options.date ? parseDate(options.date) : new Date();
  const repoPath = options.repo ?? config.defaultRepo ?? process.cwd();
  const useGit = options.git !== false;
  const repo = useGit ? await getRepoInfo(repoPath) : undefined;
  const commits = useGit && repo ? await listCommits(repo.path, dailyRange(date)) : [];
  const event = createJournalEvent({
    date,
    repo,
    commits,
    device: config.device
  });
  event.analysis = await analyzeEventWithOpenAICompatibleApi(event, config.analysis);

  const eventPath = await writeJournalEvent(config.journalRoot, event);
  const events = await readJournalEvents(config.journalRoot, date);
  const existingMarkdown = await readJournal(config.journalRoot, "daily", date);
  const templateMarkdown = existingMarkdown ? undefined : await readTemplate(config.journalRoot, "daily.md");
  const journalPath = await writeJournal(
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

  return { eventPath, journalPath };
}

export async function runDailySync(options: Partial<DailyCommandOptions> = {}): Promise<{
  eventPath: string;
  journalPath: string;
  committed: boolean;
}> {
  const config = await loadConfig();
  const date = options.date ? parseDate(options.date) : new Date();

  await ensureCleanWorktree(config.journalRoot);
  await pullJournalRepo(config.journalRoot);

  const result = await runDaily({
    ...options,
    date: formatDate(date)
  });
  const committed = await commitJournalChanges({
    repoPath: config.journalRoot,
    files: [result.eventPath, result.journalPath],
    message: `chore(journal): update ${formatDate(date)} daily journal`
  });

  await pushJournalRepo(config.journalRoot);

  return {
    ...result,
    committed
  };
}
