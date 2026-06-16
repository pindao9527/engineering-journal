#!/usr/bin/env node
import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Command } from "commander";
import { registerInitCommand } from "./commands/init.js";
import { registerDailyCommand } from "./commands/daily.js";
import { registerRenderCommand } from "./commands/render.js";
import { registerStatusCommand } from "./commands/status.js";
import { registerPeriodicCommands } from "./commands/periodic.js";
import { registerAnalyzeCommand } from "./commands/analyze.js";
import { registerSearchCommand } from "./commands/search.js";
import { registerStatsCommand } from "./commands/stats.js";

export function createProgram(): Command {
  const program = new Command();

  program
    .name("englog")
    .description("Turn Git activity into a durable personal engineering journal.")
    .version("0.1.1");

  registerInitCommand(program);
  registerDailyCommand(program);
  registerPeriodicCommands(program);
  registerRenderCommand(program);
  registerAnalyzeCommand(program);
  registerSearchCommand(program);
  registerStatsCommand(program);
  registerStatusCommand(program);

  return program;
}

function isCliEntrypoint(): boolean {
  const invokedPath = process.argv[1];

  if (!invokedPath) {
    return false;
  }

  return realpathSync(fileURLToPath(import.meta.url)) === realpathSync(invokedPath);
}

if (isCliEntrypoint()) {
  try {
    await createProgram().parseAsync(process.argv);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`englog: ${message}`);
    process.exitCode = 1;
  }
}
