import { readFile } from "node:fs/promises";
import path from "node:path";

export interface EnglogConfig {
  journalRoot: string;
  defaultRepo?: string;
  device?: string;
}

export const DEFAULT_CONFIG_FILE = "englog.config.json";

export async function loadConfig(cwd = process.cwd()): Promise<EnglogConfig> {
  const configPath = path.join(cwd, DEFAULT_CONFIG_FILE);

  try {
    const raw = await readFile(configPath, "utf8");
    return JSON.parse(raw) as EnglogConfig;
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") {
      return { journalRoot: cwd };
    }
    throw error;
  }
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}
