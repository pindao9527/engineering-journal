import { format } from "date-fns";
import { simpleGit } from "simple-git";
import type { TimeRange } from "../time/periods.js";
import type { CommitDiffSummary } from "./patch.js";
import { matchesAnyPattern } from "./patterns.js";

export interface CommitSummary {
  hash: string;
  message: string;
  authorName: string;
  authorEmail?: string;
  date: string;
  repo?: string;
  repoPath?: string;
  branch?: string;
  filesChanged: number;
  insertions: number;
  deletions: number;
  changedFiles: string[];
  diff?: CommitDiffSummary;
}

export interface ListCommitsOptions {
  includeAllBranches?: boolean;
  includeMergeCommits?: boolean;
  authorEmails?: string[];
  excludeCommitMessages?: string[];
  exclude?: string[];
}

interface RawCommit {
  hash: string;
  message: string;
  authorName: string;
  authorEmail?: string;
  date: string;
}

export async function listCommits(
  repoPath: string,
  range: TimeRange,
  options: ListCommitsOptions = {}
): Promise<CommitSummary[]> {
  const git = simpleGit(repoPath);
  const commits = filterCommits(await gitLog(repoPath, range, options), options);

  return Promise.all(
    commits.map(async (commit) => {
      const stats = await getCommitNumstat(repoPath, commit.hash, options.exclude ?? []);

      return {
        hash: commit.hash,
        message: commit.message,
        authorName: commit.authorName,
        authorEmail: commit.authorEmail,
        date: commit.date,
        filesChanged: stats.changedFiles.length,
        insertions: stats.insertions,
        deletions: stats.deletions,
        changedFiles: stats.changedFiles
      };
    })
  );
}

async function gitLog(repoPath: string, range: TimeRange, options: ListCommitsOptions): Promise<RawCommit[]> {
  const args = [
    "log",
    `--since=${format(range.start, "yyyy-MM-dd'T'HH:mm:ssXXX")}`,
    `--until=${format(range.end, "yyyy-MM-dd'T'HH:mm:ssXXX")}`,
    "--pretty=format:%H%x1f%s%x1f%an%x1f%ae%x1f%aI%x1e"
  ];

  if (options.includeAllBranches ?? true) {
    args.push("--all");
  }

  if (!(options.includeMergeCommits ?? false)) {
    args.push("--no-merges");
  }

  const output = await simpleGit(repoPath).raw(args);
  return output
    .split("\x1e")
    .map((record) => record.trim())
    .filter(Boolean)
    .map((record) => {
      const [hash, message, authorName, authorEmail, date] = record.split("\x1f");
      return {
        hash,
        message,
        authorName,
        authorEmail,
        date
      };
    })
    .filter((commit) => commit.hash && commit.message && commit.authorName && commit.date);
}

function filterCommits(commits: RawCommit[], options: ListCommitsOptions): RawCommit[] {
  const authorEmails = new Set((options.authorEmails ?? []).map((email) => email.toLowerCase()));
  const excludePatterns = (options.excludeCommitMessages ?? []).map((pattern) => compileExcludePattern(pattern));
  const seen = new Set<string>();

  return commits.filter((commit) => {
    if (seen.has(commit.hash)) {
      return false;
    }
    seen.add(commit.hash);

    if (authorEmails.size > 0 && (!commit.authorEmail || !authorEmails.has(commit.authorEmail.toLowerCase()))) {
      return false;
    }

    return !excludePatterns.some((pattern) => pattern.test(commit.message));
  });
}

function compileExcludePattern(pattern: string): RegExp {
  try {
    return new RegExp(pattern, "i");
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`git.excludeCommitMessages contains an invalid regular expression (${pattern}): ${reason}`);
  }
}

async function getCommitNumstat(repoPath: string, commitHash: string, exclude: string[]): Promise<{
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

    if (matchesAnyPattern(file, exclude)) {
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
