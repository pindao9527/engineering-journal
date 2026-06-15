import path from "node:path";
import { simpleGit } from "simple-git";

export interface RepoInfo {
  name: string;
  path: string;
  branch: string;
}

export async function getRepoInfo(repoPath = process.cwd()): Promise<RepoInfo> {
  const git = simpleGit(repoPath);
  const root = await git.revparse(["--show-toplevel"]);
  const branch = await git.revparse(["--abbrev-ref", "HEAD"]);

  return {
    name: path.basename(root.trim()),
    path: root.trim(),
    branch: branch.trim()
  };
}
