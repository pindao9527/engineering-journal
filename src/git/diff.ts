import { simpleGit } from "simple-git";

export interface DiffStats {
  filesChanged: number;
  insertions: number;
  deletions: number;
  files: string[];
}

export async function getCommitDiffStats(repoPath: string, commitHash: string): Promise<DiffStats> {
  const git = simpleGit(repoPath);
  const summary = await git.show(["--stat", "--format=", commitHash]);
  const files = summary
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.includes("|"))
    .map((line) => line.split("|")[0].trim());

  return {
    filesChanged: files.length,
    insertions: 0,
    deletions: 0,
    files
  };
}
