import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export interface EnglogConfig {
  journalRoot: string;
  defaultRepo?: string;
  device?: string;
  git: GitConfig;
  analysis?: AnalysisConfig;
}

export interface GitConfig {
  collectDiff: boolean;
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
  git?: Partial<GitConfig>;
  analysis?: AnalysisConfig;
};

export const DEFAULT_CONFIG_FILE = "englog.config.json";

export const DEFAULT_GIT_CONFIG: GitConfig = {
  collectDiff: false,
  maxDiffChars: 30000,
  maxFileDiffChars: 8000,
  exclude: [
    "node_modules/**",
    "dist/**",
    "build/**",
    "coverage/**",
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
      return { journalRoot: cwd, git: DEFAULT_GIT_CONFIG };
    }
    throw error;
  }
}

export async function writeDefaultConfig(cwd = process.cwd()): Promise<void> {
  const configPath = path.join(cwd, DEFAULT_CONFIG_FILE);
  const config: EnglogConfig = {
    journalRoot: ".",
    defaultRepo: ".",
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
    ...config,
    journalRoot: path.resolve(cwd, config.journalRoot ?? "."),
    defaultRepo: config.defaultRepo ? path.resolve(cwd, config.defaultRepo) : undefined,
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
    maxDiffChars,
    maxFileDiffChars,
    exclude: Array.isArray(config?.exclude) ? config.exclude.filter((pattern) => typeof pattern === "string") : DEFAULT_GIT_CONFIG.exclude
  };
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
