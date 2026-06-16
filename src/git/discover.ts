import { readdir, stat } from "node:fs/promises";
import path from "node:path";

const SKIP_DIRECTORIES = new Set([
  ".cache",
  ".next",
  ".turbo",
  ".vercel",
  "build",
  "coverage",
  "dist",
  "node_modules"
]);

export async function discoverGitRepositories(roots: string[]): Promise<string[]> {
  const repositories = new Set<string>();

  for (const root of roots) {
    await discover(root, repositories);
  }

  return [...repositories].sort((a, b) => a.localeCompare(b));
}

async function discover(directory: string, repositories: Set<string>): Promise<void> {
  let directoryStat;
  try {
    directoryStat = await stat(directory);
  } catch {
    return;
  }

  if (!directoryStat.isDirectory()) {
    return;
  }

  if (await hasGitDirectory(directory)) {
    repositories.add(directory);
    return;
  }

  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch {
    return;
  }

  await Promise.all(
    entries
      .filter((entry) => entry.isDirectory() && !SKIP_DIRECTORIES.has(entry.name))
      .map((entry) => discover(path.join(directory, entry.name), repositories))
  );
}

async function hasGitDirectory(directory: string): Promise<boolean> {
  try {
    const gitPath = path.join(directory, ".git");
    const gitStat = await stat(gitPath);
    return gitStat.isDirectory() || gitStat.isFile();
  } catch {
    return false;
  }
}
