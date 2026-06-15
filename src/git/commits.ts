import { simpleGit } from "simple-git";
import type { TimeRange } from "../time/periods.js";

export interface CommitSummary {
  hash: string;
  message: string;
  authorName: string;
  date: string;
}

export async function listCommits(repoPath: string, range: TimeRange): Promise<CommitSummary[]> {
  const git = simpleGit(repoPath);
  const log = await git.log({
    "--since": range.start.toISOString(),
    "--until": range.end.toISOString()
  });

  return log.all.map((commit) => ({
    hash: commit.hash,
    message: commit.message,
    authorName: commit.author_name,
    date: commit.date
  }));
}
