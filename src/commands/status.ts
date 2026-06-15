import type { Command } from "commander";
import { loadConfig } from "../config/load-config.js";
import { getJournalGitStatus } from "../git/sync.js";
import { hasManualMarkers } from "../journal/manual-section.js";
import { readJournalEvents } from "../storage/events.js";
import { readJournal } from "../storage/journals.js";
import { formatDate, parseDate } from "../time/format.js";

export interface StatusCommandOptions {
  date?: string;
}

export function registerStatusCommand(program: Command): void {
  program
    .command("status")
    .description("Show journal freshness, manual markers, and Git sync status.")
    .option("--date <date>", "journal date in yyyy-MM-dd format")
    .action(async (options: StatusCommandOptions) => {
      console.log(await runStatus(options));
    });
}

export async function runStatus(options: StatusCommandOptions = {}): Promise<string> {
  const config = await loadConfig();
  const date = options.date ? parseDate(options.date) : new Date();
  const events = await readJournalEvents(config.journalRoot, date);
  const journal = await readJournal(config.journalRoot, "daily", date);
  const gitStatus = await getJournalGitStatus(config.journalRoot);
  const manualMarkersOk = journal ? hasManualMarkers(journal) : undefined;

  return [
    `date: ${formatDate(date)}`,
    `events: ${events.length}`,
    `daily journal: ${journal ? "yes" : "no"}`,
    `manual markers: ${manualMarkersOk === undefined ? "n/a" : manualMarkersOk ? "ok" : "missing"}`,
    `git branch: ${gitStatus.branch}`,
    `worktree: ${gitStatus.isClean ? "clean" : `dirty (${gitStatus.changedFiles.length} file(s))`}`,
    `unpushed commits: ${gitStatus.hasUpstream ? gitStatus.ahead : "unknown (no upstream)"}`,
    `remote updates: ${gitStatus.hasUpstream ? gitStatus.behind : "unknown (no upstream)"}`,
    `next action: ${getNextAction({
      eventCount: events.length,
      hasJournal: journal !== undefined,
      manualMarkersOk,
      isClean: gitStatus.isClean,
      hasUpstream: gitStatus.hasUpstream,
      ahead: gitStatus.ahead,
      behind: gitStatus.behind
    })}`
  ].join("\n");
}

function getNextAction(input: {
  eventCount: number;
  hasJournal: boolean;
  manualMarkersOk?: boolean;
  isClean: boolean;
  hasUpstream: boolean;
  ahead: number;
  behind: number;
}): string {
  if (!input.hasJournal || input.eventCount === 0) {
    return "run englog daily or englog daily --sync";
  }

  if (input.manualMarkersOk === false) {
    return "restore englog manual markers before re-rendering";
  }

  if (!input.isClean) {
    return "review and commit or stash local changes";
  }

  if (!input.hasUpstream) {
    return "configure an upstream remote before using sync";
  }

  if (input.behind > 0) {
    return "run englog daily --sync to pull remote updates";
  }

  if (input.ahead > 0) {
    return "run git push";
  }

  return "up to date";
}
