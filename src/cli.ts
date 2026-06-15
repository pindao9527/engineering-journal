#!/usr/bin/env node
import { Command } from "commander";
import { registerInitCommand } from "./commands/init.js";
import { registerDailyCommand } from "./commands/daily.js";
import { registerRenderCommand } from "./commands/render.js";

export function createProgram(): Command {
  const program = new Command();

  program
    .name("englog")
    .description("Turn Git activity into a durable personal engineering journal.")
    .version("0.1.0");

  registerInitCommand(program);
  registerDailyCommand(program);
  registerRenderCommand(program);

  return program;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    await createProgram().parseAsync(process.argv);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`englog: ${message}`);
    process.exitCode = 1;
  }
}
