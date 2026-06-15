import { simpleGit } from "simple-git";
import type { TimeRange } from "../time/periods.js";

export interface CommitSummary {
  hash: string;
  message: string;
  authorName: string;
  authorEmail?: string;
  date: string;
  filesChanged: number;
  insertions: number;
  deletions: number;
  changedFiles: string[];
}

export async function listCommits(repoPath: string, range: TimeRange): Promise<CommitSummary[]> {
  const git = simpleGit(repoPath);
  const log = await git.log({
    "--since": range.start.toISOString(),
    "--until": range.end.toISOString()
  });

  return Promise.all(
    log.all.map(async (commit) => {
      const stats = await getCommitNumstat(repoPath, commit.hash);

      return {
        hash: commit.hash,
        message: commit.message,
        authorName: commit.author_name,
        authorEmail: commit.author_email,
        date: commit.date,
        filesChanged: stats.changedFiles.length,
        insertions: stats.insertions,
        deletions: stats.deletions,
        changedFiles: stats.changedFiles
      };
    })
  );
}

async function getCommitNumstat(repoPath: string, commitHash: string): Promise<{
  insertions: number;
  deletions: number;
  changedFiles: string[];
}> {
  const git = simpleGit(repoPath);
  const output = await git.show(["--numstat", "--format=", commitHash]);
  const changedFiles: string[] = [];
  let insertions = 0;
  let deletions = 0;

  for (const line of output.split("\n")) {
    const [added, deleted, file] = line.split("\t");
    if (!added || !deleted || !file) {
      continue;
    }

    changedFiles.push(file);
    insertions += added === "-" ? 0 : Number.parseInt(added, 10);
    deletions += deleted === "-" ? 0 : Number.parseInt(deleted, 10);
  }

  return {
    insertions,
    deletions,
    changedFiles
  };
}
