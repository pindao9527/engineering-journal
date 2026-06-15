import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export interface EnglogConfig {
  journalRoot: string;
  defaultRepo?: string;
  device?: string;
  analysis?: AnalysisConfig;
}

export interface AnalysisConfig {
  provider?: "openai-compatible";
  enabled?: boolean;
  api?: "responses" | "chat-completions";
  baseUrl?: string;
  model?: string;
  apiKeyEnv?: string;
  temperature?: number;
}

export const DEFAULT_CONFIG_FILE = "englog.config.json";

export async function loadConfig(cwd = process.cwd()): Promise<EnglogConfig> {
  const configPath = path.join(cwd, DEFAULT_CONFIG_FILE);

  try {
    const raw = await readFile(configPath, "utf8");
    return normalizeConfig(JSON.parse(raw) as EnglogConfig, cwd);
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") {
      return { journalRoot: cwd };
    }
    throw error;
  }
}

export async function writeDefaultConfig(cwd = process.cwd()): Promise<void> {
  const configPath = path.join(cwd, DEFAULT_CONFIG_FILE);
  const config: EnglogConfig = {
    journalRoot: ".",
    defaultRepo: ".",
    analysis: {
      enabled: false,
      provider: "openai-compatible",
      api: "responses",
      baseUrl: "https://api.openai.com/v1",
      model: "gpt-5.5",
      apiKeyEnv: "OPENAI_API_KEY"
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

function normalizeConfig(config: EnglogConfig, cwd: string): EnglogConfig {
  return {
    ...config,
    journalRoot: path.resolve(cwd, config.journalRoot),
    defaultRepo: config.defaultRepo ? path.resolve(cwd, config.defaultRepo) : undefined
  };
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}
