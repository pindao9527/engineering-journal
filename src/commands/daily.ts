import type { Command } from "commander";
import { analyzeJournalEvent } from "../analysis/analyze-event.js";
import { loadConfig } from "../config/load-config.js";
import { listCommits } from "../git/commits.js";
import type { CommitSummary } from "../git/commits.js";
import { discoverGitRepositories } from "../git/discover.js";
import { collectDiffMetadata, getCommitPatch } from "../git/patch.js";
import { getRepoInfo } from "../git/repo.js";
import type { RepoInfo } from "../git/repo.js";
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
  includeDiff?: boolean;
}

export function registerDailyCommand(program: Command): void {
  program
    .command("daily")
    .description("Collect today's Git activity and render a daily journal.")
    .option("--date <date>", "journal date in yyyy-MM-dd format")
    .option("--repo <path>", "Git repository path to inspect")
    .option("--no-git", "skip Git collection and render an empty journal")
    .option("--sync", "pull, collect, render, commit, and push when supported")
    .option("--include-diff", "collect bounded commit patches for AI analysis")
    .action(async (options: DailyCommandOptions) => {
      if (options.sync) {
        const result = await runDailySync(options);
        console.log(`event: ${result.eventPath}`);
        console.log(`journal: ${result.journalPath}`);
        console.log(formatDiffCollectionStatus(result.diffCollection));
        console.log(`commit: ${result.committed ? "created" : "skipped"}`);
        console.log("push: done");
        return;
      }

      const result = await runDaily(options);
      console.log(`event: ${result.eventPath}`);
      console.log(`journal: ${result.journalPath}`);
      console.log(formatDiffCollectionStatus(result.diffCollection));
    });
}

export async function runDaily(options: Partial<DailyCommandOptions> = {}): Promise<{
  eventPath: string;
  journalPath: string;
  diffCollection?: {
    enabled: boolean;
    maxDiffChars: number;
    maxFileDiffChars: number;
    excludedFiles: string[];
    truncated: boolean;
  };
}> {
  const config = await loadConfig();
  const date = options.date ? parseDate(options.date) : new Date();
  const useGit = options.git !== false;
  const range = dailyRange(date);
  const activity = useGit
    ? await collectGitActivity({
        repoPath: options.repo,
        scanRoots: options.repo ? [] : config.scanRoots,
        range,
        gitConfig: config.git
      })
    : { repo: undefined, commits: [] };
  const collectDiff = useGit && activity.commits.length > 0 && (options.includeDiff === true || config.git.collectDiff);

  if (collectDiff) {
    await Promise.all(
      activity.commits.map(async (commit) => {
        commit.diff = await getCommitPatch(commit.repoPath ?? activity.repo?.path ?? process.cwd(), commit.hash, config.git);
      })
    );
  }

  const diffCollection = collectDiff ? collectDiffMetadata(activity.commits, config.git) : undefined;
  const event = createJournalEvent({
    date,
    repo: activity.repo,
    commits: activity.commits,
    device: config.device,
    diffCollection
  });
  const analyzed = await analyzeJournalEvent(event, config.analysis);
  event.analysis = analyzed.analysis;
  event.tags = analyzed.tags;

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

  return { eventPath, journalPath, diffCollection };
}

async function collectGitActivity(input: {
  repoPath?: string;
  scanRoots: string[];
  range: ReturnType<typeof dailyRange>;
  gitConfig: Awaited<ReturnType<typeof loadConfig>>["git"];
}): Promise<{ repo?: RepoInfo; commits: CommitSummary[] }> {
  const repoPaths = input.repoPath
    ? [input.repoPath]
    : input.scanRoots.length > 0
      ? await discoverGitRepositories(input.scanRoots)
      : [process.cwd()];

  const collected = await Promise.all(
    repoPaths.map(async (repoPath) => {
      const repo = await getRepoInfo(repoPath);
      const commits = await listCommits(repo.path, input.range, {
        includeAllBranches: input.gitConfig.includeAllBranches,
        includeMergeCommits: input.gitConfig.includeMergeCommits,
        authorEmails: input.gitConfig.authorEmails,
        excludeCommitMessages: input.gitConfig.excludeCommitMessages,
        exclude: input.gitConfig.exclude
      });

      return {
        repo,
        commits: commits.map((commit) => ({
          ...commit,
          repo: repo.name,
          repoPath: repo.path,
          branch: repo.branch
        }))
      };
    })
  );

  const commits = collected.flatMap((entry) => entry.commits).sort((a, b) => a.date.localeCompare(b.date));
  return {
    repo: collected.length === 1 ? collected[0].repo : undefined,
    commits
  };
}

export async function runDailySync(options: Partial<DailyCommandOptions> = {}): Promise<{
  eventPath: string;
  journalPath: string;
  committed: boolean;
  diffCollection?: {
    enabled: boolean;
    maxDiffChars: number;
    maxFileDiffChars: number;
    excludedFiles: string[];
    truncated: boolean;
  };
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

function formatDiffCollectionStatus(diffCollection: Awaited<ReturnType<typeof runDaily>>["diffCollection"]): string {
  if (!diffCollection?.enabled) {
    return "diff collection: disabled";
  }

  return [
    `diff collection: enabled, max ${diffCollection.maxDiffChars} chars`,
    `excluded ${diffCollection.excludedFiles.length} file(s)`,
    `truncated: ${diffCollection.truncated ? "yes" : "no"}`
  ].join(", ");
}
