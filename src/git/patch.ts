import { simpleGit } from "simple-git";

export interface DiffCollectionOptions {
  maxDiffChars: number;
  maxFileDiffChars: number;
  exclude: string[];
}

export interface CommitDiffSummary {
  included: boolean;
  truncated: boolean;
  omittedReason?: string;
  files: FileDiffSummary[];
}

export interface FileDiffSummary {
  path: string;
  insertions: number;
  deletions: number;
  patch?: string;
  truncated: boolean;
  omittedReason?: string;
}

interface PatchSection {
  path: string;
  patch: string;
  binary: boolean;
}

export async function getCommitPatch(
  repoPath: string,
  commitHash: string,
  options: DiffCollectionOptions
): Promise<CommitDiffSummary> {
  const git = simpleGit(repoPath);
  const [patchOutput, numstatOutput] = await Promise.all([
    git.show(["--format=", "--patch", "--find-renames", "--find-copies", commitHash]),
    git.show(["--numstat", "--format=", commitHash])
  ]);
  const stats = parseNumstat(numstatOutput);
  const sections = parsePatchSections(patchOutput);
  const files: FileDiffSummary[] = [];
  let remaining = options.maxDiffChars;
  let truncated = false;

  for (const section of sections) {
    const fileStats = stats.get(section.path) ?? { insertions: 0, deletions: 0 };
    const excluded = matchesAnyPattern(section.path, options.exclude);

    if (excluded) {
      files.push({
        path: section.path,
        insertions: fileStats.insertions,
        deletions: fileStats.deletions,
        truncated: false,
        omittedReason: "excluded-by-pattern"
      });
      continue;
    }

    if (section.binary) {
      files.push({
        path: section.path,
        insertions: fileStats.insertions,
        deletions: fileStats.deletions,
        truncated: false,
        omittedReason: "binary-file"
      });
      continue;
    }

    if (remaining <= 0) {
      files.push({
        path: section.path,
        insertions: fileStats.insertions,
        deletions: fileStats.deletions,
        truncated: true,
        omittedReason: "max-diff-chars-exceeded"
      });
      truncated = true;
      continue;
    }

    const fileLimit = Math.min(options.maxFileDiffChars, remaining);
    const fileTruncated = section.patch.length > fileLimit;
    const patch = section.patch.slice(0, fileLimit);
    remaining -= patch.length;
    truncated = truncated || fileTruncated;

    files.push({
      path: section.path,
      insertions: fileStats.insertions,
      deletions: fileStats.deletions,
      patch,
      truncated: fileTruncated
    });
  }

  for (const [filePath, fileStats] of stats) {
    if (files.some((file) => file.path === filePath)) {
      continue;
    }

    files.push({
      path: filePath,
      insertions: fileStats.insertions,
      deletions: fileStats.deletions,
      truncated: false,
      omittedReason: matchesAnyPattern(filePath, options.exclude) ? "excluded-by-pattern" : "patch-not-available"
    });
  }

  return {
    included: files.some((file) => file.patch),
    truncated,
    files
  };
}

export function collectDiffMetadata(commits: Array<{ diff?: CommitDiffSummary }>, options: DiffCollectionOptions): {
  enabled: boolean;
  maxDiffChars: number;
  maxFileDiffChars: number;
  excludedFiles: string[];
  truncated: boolean;
} {
  const files = commits.flatMap((commit) => commit.diff?.files ?? []);

  return {
    enabled: true,
    maxDiffChars: options.maxDiffChars,
    maxFileDiffChars: options.maxFileDiffChars,
    excludedFiles: [...new Set(files.filter((file) => file.omittedReason === "excluded-by-pattern").map((file) => file.path))].sort((a, b) => a.localeCompare(b)),
    truncated: files.some((file) => file.truncated)
  };
}

function parseNumstat(output: string): Map<string, { insertions: number; deletions: number }> {
  const stats = new Map<string, { insertions: number; deletions: number }>();

  for (const line of output.split("\n")) {
    const [added, deleted, file] = line.split("\t");
    if (!added || !deleted || !file) {
      continue;
    }

    const filePath = normalizeNumstatPath(file);
    stats.set(filePath, {
      insertions: added === "-" ? 0 : Number.parseInt(added, 10),
      deletions: deleted === "-" ? 0 : Number.parseInt(deleted, 10)
    });
  }

  return stats;
}

function normalizeNumstatPath(file: string): string {
  const renameMatch = file.match(/^(.*)\{(.+) => (.+)\}(.*)$/);
  if (!renameMatch) {
    return file;
  }

  return `${renameMatch[1]}${renameMatch[3]}${renameMatch[4]}`;
}

function parsePatchSections(output: string): PatchSection[] {
  const sections: PatchSection[] = [];
  const parts = output.split(/^diff --git /m).filter(Boolean);

  for (const part of parts) {
    const patch = `diff --git ${part}`.trimEnd();
    const pathMatch = patch.match(/^diff --git a\/.* b\/(.+)$/m);
    const renameMatch = patch.match(/^rename to (.+)$/m);
    const deleteMatch = patch.match(/^deleted file mode /m) ? patch.match(/^--- a\/(.+)$/m) : undefined;
    const filePath = renameMatch?.[1] ?? pathMatch?.[1] ?? deleteMatch?.[1];

    if (!filePath) {
      continue;
    }

    sections.push({
      path: filePath,
      patch,
      binary: /^(Binary files .* differ|GIT binary patch)$/m.test(patch)
    });
  }

  return sections;
}

function matchesAnyPattern(filePath: string, patterns: string[]): boolean {
  const normalized = filePath.replace(/\\/g, "/");
  const basename = normalized.split("/").at(-1) ?? normalized;
  return patterns.some((pattern) => {
    const normalizedPattern = pattern.replace(/\\/g, "/");
    const regex = globToRegExp(normalizedPattern);
    return regex.test(normalized) || (!normalizedPattern.includes("/") && regex.test(basename));
  });
}

function globToRegExp(pattern: string): RegExp {
  let source = "";

  for (let i = 0; i < pattern.length; i += 1) {
    const char = pattern[i];
    const next = pattern[i + 1];

    if (char === "*" && next === "*") {
      source += ".*";
      i += 1;
    } else if (char === "*") {
      source += "[^/]*";
    } else if (char === "?") {
      source += "[^/]";
    } else {
      source += escapeRegExp(char);
    }
  }

  return new RegExp(`^${source}$`);
}

function escapeRegExp(value: string): string {
  return value.replace(/[|\\{}()[\]^$+?.]/g, "\\$&");
}
