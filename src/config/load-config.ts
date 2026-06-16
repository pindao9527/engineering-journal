import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export interface EnglogConfig {
  journalRoot: string;
  scanRoots: string[];
  device?: string;
  git: GitConfig;
  analysis?: AnalysisConfig;
}

export interface GitConfig {
  collectDiff: boolean;
  includeAllBranches: boolean;
  includeMergeCommits: boolean;
  authorEmails: string[];
  excludeCommitMessages: string[];
  maxDiffChars: number;
  maxFileDiffChars: number;
  exclude: string[];
}

export interface AnalysisConfig {
  provider?: "openai-compatible";
  enabled?: boolean;
  api?: "responses" | "chat-completions";
  baseUrl?: string;
  model?: string;
  apiKey?: string;
  temperature?: number;
}

type RawEnglogConfig = Omit<Partial<EnglogConfig>, "git" | "analysis"> & {
  defaultRepo?: string;
  git?: Partial<GitConfig>;
  analysis?: AnalysisConfig;
};

export const DEFAULT_CONFIG_FILE = "englog.config.json";

export const DEFAULT_GIT_CONFIG: GitConfig = {
  collectDiff: false,
  includeAllBranches: true,
  includeMergeCommits: false,
  authorEmails: [],
  excludeCommitMessages: [],
  maxDiffChars: 30000,
  maxFileDiffChars: 8000,
  exclude: [
    "node_modules/**",
    "dist/**",
    "build/**",
    "coverage/**",
    "openspec/**",
    ".openspec/**",
    "*.lock",
    "package-lock.json",
    "pnpm-lock.yaml",
    "yarn.lock",
    ".env*",
    "*.pem",
    "*.key",
    "*.crt",
    "*.p12",
    "*.png",
    "*.jpg",
    "*.jpeg",
    "*.gif",
    "*.webp",
    "*.pdf",
    "*.zip",
    "*.tar",
    "*.gz"
  ]
};

export async function loadConfig(cwd = process.cwd()): Promise<EnglogConfig> {
  const configPath = path.join(cwd, DEFAULT_CONFIG_FILE);

  try {
    const raw = await readFile(configPath, "utf8");
    return normalizeConfig(JSON.parse(raw) as RawEnglogConfig, cwd);
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") {
      return { journalRoot: cwd, scanRoots: [], git: DEFAULT_GIT_CONFIG };
    }
    throw error;
  }
}

export async function writeDefaultConfig(cwd = process.cwd()): Promise<void> {
  const configPath = path.join(cwd, DEFAULT_CONFIG_FILE);
  const config: EnglogConfig = {
    journalRoot: ".",
    scanRoots: [],
    git: DEFAULT_GIT_CONFIG,
    analysis: {
      enabled: false,
      provider: "openai-compatible",
      api: "responses",
      baseUrl: "https://api.openai.com/v1",
      model: "gpt-5.5",
      apiKey: ""
    }
  };

  try {
    await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`, {
      flag: "wx"
    });
  } catch (error) {
    if (isNodeError(error) && error.code === "EEXIST") {
      return;
    }
    throw error;
  }
}

function normalizeConfig(config: RawEnglogConfig, cwd: string): EnglogConfig {
  return {
    device: config.device,
    analysis: config.analysis,
    journalRoot: path.resolve(cwd, config.journalRoot ?? "."),
    scanRoots: Array.isArray(config.scanRoots)
      ? config.scanRoots.filter((root) => typeof root === "string").map((root) => path.resolve(cwd, root))
      : [],
    git: normalizeGitConfig(config.git)
  };
}

function normalizeGitConfig(config: Partial<GitConfig> | undefined): GitConfig {
  const maxDiffChars = positiveInteger(config?.maxDiffChars, DEFAULT_GIT_CONFIG.maxDiffChars, "git.maxDiffChars");
  const maxFileDiffChars = positiveInteger(
    config?.maxFileDiffChars,
    DEFAULT_GIT_CONFIG.maxFileDiffChars,
    "git.maxFileDiffChars"
  );

  return {
    collectDiff: config?.collectDiff ?? DEFAULT_GIT_CONFIG.collectDiff,
    includeAllBranches: config?.includeAllBranches ?? DEFAULT_GIT_CONFIG.includeAllBranches,
    includeMergeCommits: config?.includeMergeCommits ?? DEFAULT_GIT_CONFIG.includeMergeCommits,
    authorEmails: stringArray(config?.authorEmails),
    excludeCommitMessages: stringArray(config?.excludeCommitMessages),
    maxDiffChars,
    maxFileDiffChars,
    exclude: Array.isArray(config?.exclude) ? config.exclude.filter((pattern) => typeof pattern === "string") : DEFAULT_GIT_CONFIG.exclude
  };
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item) => typeof item === "string" && item.trim().length > 0) : [];
}

function positiveInteger(value: unknown, fallback: number, field: string): number {
  if (value === undefined) {
    return fallback;
  }

  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
    throw new Error(`${field} must be a positive integer.`);
  }

  return value;
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}
