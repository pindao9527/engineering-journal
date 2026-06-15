import path from "node:path";
import { simpleGit } from "simple-git";

export interface RepoInfo {
  name: string;
  path: string;
  branch: string;
  author: string;
}

export async function getRepoInfo(repoPath = process.cwd()): Promise<RepoInfo> {
  const git = simpleGit(repoPath);
  try {
    const root = await git.revparse(["--show-toplevel"]);
    const branch = await git.revparse(["--abbrev-ref", "HEAD"]);
    const author = await getGitAuthor(repoPath);

    return {
      name: path.basename(root.trim()),
      path: root.trim(),
      branch: branch.trim(),
      author
    };
  } catch (error) {
    throw new Error(`Cannot inspect Git repository at ${repoPath}. Use --no-git to render an empty journal.`);
  }
}

async function getGitAuthor(repoPath: string): Promise<string> {
  const name = await getGitConfig(repoPath, "user.name");
  const email = await getGitConfig(repoPath, "user.email");

  if (name && email) {
    return `${name} <${email}>`;
  }

  return name || email || "unknown";
}

async function getGitConfig(repoPath: string, key: string): Promise<string> {
  try {
    return (await simpleGit(repoPath).raw(["config", key])).trim();
  } catch {
    return "";
  }
}
