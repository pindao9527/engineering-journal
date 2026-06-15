import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Command } from "commander";
import { writeDefaultConfig } from "../config/load-config.js";

const JOURNAL_DIRECTORIES = [
  "templates",
  "data/events",
  "data/commits",
  "journals/daily",
  "journals/weekly",
  "journals/monthly",
  "journals/quarterly",
  "journals/half-year",
  "journals/yearly"
];

const DEFAULT_TEMPLATES: Record<string, string> = {
  "daily.md": [
    "# Engineering Journal {{date}}",
    "",
    "<!-- englog:auto:start -->",
    "<!-- englog:auto:end -->",
    "",
    "<!-- englog:manual:start -->",
    "## 人工记录",
    "",
    "<!-- englog:manual:end -->",
    ""
  ].join("\n"),
  "weekly.md": "# Weekly Engineering Journal {{period}}\n\n",
  "monthly.md": "# Monthly Engineering Journal {{period}}\n\n",
  "quarterly.md": "# Quarterly Engineering Journal {{period}}\n\n",
  "half-year.md": "# Half-Year Engineering Journal {{period}}\n\n",
  "yearly.md": "# Yearly Engineering Journal {{period}}\n\n"
};

const CACHE_GITIGNORE_RULES = [".cache/", "*.db", "*.db-shm", "*.db-wal"];

export function registerInitCommand(program: Command): void {
  program
    .command("init")
    .description("Create the journal directory structure and default config.")
    .option("-f, --force", "overwrite generated templates when supported")
    .action(async (options: { force?: boolean }) => {
      await initializeJournal(process.cwd(), Boolean(options.force));
      console.log("englog initialized.");
    });
}

export async function initializeJournal(cwd: string, force = false): Promise<void> {
  await Promise.all(JOURNAL_DIRECTORIES.map((directory) => mkdir(path.join(cwd, directory), { recursive: true })));
  await Promise.all(
    Object.entries(DEFAULT_TEMPLATES).map(([fileName, content]) => writeTemplate(cwd, fileName, content, force))
  );
  await writeDefaultConfig(cwd);
  await ensureGitignoreRules(cwd);
}

async function writeTemplate(cwd: string, fileName: string, content: string, force: boolean): Promise<void> {
  const filePath = path.join(cwd, "templates", fileName);
  await writeFile(filePath, content, {
    encoding: "utf8",
    flag: force ? "w" : "wx"
  }).catch((error: unknown) => {
    if (isNodeError(error) && error.code === "EEXIST") {
      return;
    }
    throw error;
  });
}

async function ensureGitignoreRules(cwd: string): Promise<void> {
  const gitignorePath = path.join(cwd, ".gitignore");
  let existing = "";

  try {
    existing = await readFile(gitignorePath, "utf8");
  } catch (error) {
    if (!(isNodeError(error) && error.code === "ENOENT")) {
      throw error;
    }
  }

  const existingLines = new Set(existing.split(/\r?\n/).map((line) => line.trim()));
  const missingRules = CACHE_GITIGNORE_RULES.filter((rule) => !existingLines.has(rule));

  if (missingRules.length === 0) {
    return;
  }

  const next = [existing.trimEnd(), ...missingRules].filter(Boolean).join("\n");
  await writeFile(gitignorePath, `${next}\n`, "utf8");
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}
