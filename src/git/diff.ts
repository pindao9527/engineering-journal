import { simpleGit } from "simple-git";

export interface DiffStats {
  filesChanged: number;
  insertions: number;
  deletions: number;
  files: string[];
}

export async function getCommitDiffStats(repoPath: string, commitHash: string): Promise<DiffStats> {
  const git = simpleGit(repoPath);
  const summary = await git.show(["--numstat", "--format=", commitHash]);
  const files: string[] = [];
  let insertions = 0;
  let deletions = 0;

  for (const line of summary.split("\n")) {
    const [added, deleted, file] = line.split("\t");
    if (!added || !deleted || !file) {
      continue;
    }

    files.push(file);
    insertions += added === "-" ? 0 : Number.parseInt(added, 10);
    deletions += deleted === "-" ? 0 : Number.parseInt(deleted, 10);
  }

  return {
    filesChanged: files.length,
    insertions,
    deletions,
    files
  };
}
