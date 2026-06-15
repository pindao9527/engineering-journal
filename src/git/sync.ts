import path from "node:path";
import { simpleGit } from "simple-git";

export interface JournalGitStatus {
  branch: string;
  isClean: boolean;
  changedFiles: string[];
  ahead: number;
  behind: number;
  hasUpstream: boolean;
}

export async function getJournalGitStatus(repoPath: string): Promise<JournalGitStatus> {
  const git = simpleGit(repoPath);
  const status = await git.status();
  const branch = status.current || "unknown";
  const upstreamCounts = await getUpstreamCounts(repoPath);

  return {
    branch,
    isClean: status.files.length === 0,
    changedFiles: status.files.map((file) => file.path),
    ahead: upstreamCounts?.ahead ?? 0,
    behind: upstreamCounts?.behind ?? 0,
    hasUpstream: upstreamCounts !== undefined
  };
}

export async function ensureCleanWorktree(repoPath: string): Promise<void> {
  const status = await getJournalGitStatus(repoPath);

  if (status.isClean) {
    return;
  }

  throw new Error(
    [
      "Cannot sync because the journal repository has uncommitted changes.",
      `Changed files: ${status.changedFiles.join(", ")}`,
      "Commit, stash, or discard those changes before running englog daily --sync."
    ].join("\n")
  );
}

export async function pullJournalRepo(repoPath: string): Promise<void> {
  try {
    await simpleGit(repoPath).pull(["--rebase"]);
  } catch (error) {
    throw new Error(
      [
        `git pull --rebase failed: ${formatGitError(error)}`,
        "Resolve the rebase or remote configuration issue, then run englog daily --sync again."
      ].join("\n")
    );
  }
}

export async function commitJournalChanges(input: {
  repoPath: string;
  files: string[];
  message: string;
}): Promise<boolean> {
  const git = simpleGit(input.repoPath);
  const relativeFiles = input.files.map((file) => path.relative(input.repoPath, file));

  await git.add(relativeFiles);

  if (!(await hasStagedChanges(input.repoPath))) {
    return false;
  }

  await git.commit(input.message);
  return true;
}

export async function pushJournalRepo(repoPath: string): Promise<void> {
  try {
    await simpleGit(repoPath).push();
  } catch (error) {
    throw new Error(
      [
        `git push failed: ${formatGitError(error)}`,
        "Local journal changes were kept in this repository.",
        "Resolve the push issue, then run git push or englog daily --sync again."
      ].join("\n")
    );
  }
}

async function hasStagedChanges(repoPath: string): Promise<boolean> {
  const output = await simpleGit(repoPath).diff(["--cached", "--name-only"]);
  return output.trim().length > 0;
}

async function getUpstreamCounts(repoPath: string): Promise<{ ahead: number; behind: number } | undefined> {
  const git = simpleGit(repoPath);

  try {
    const output = await git.raw(["rev-list", "--left-right", "--count", "HEAD...@{u}"]);
    const [ahead, behind] = output.trim().split(/\s+/).map((value) => Number.parseInt(value, 10));

    return {
      ahead: Number.isFinite(ahead) ? ahead : 0,
      behind: Number.isFinite(behind) ? behind : 0
    };
  } catch {
    return undefined;
  }
}

function formatGitError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}
