import type { Command } from "commander";

export function registerInitCommand(program: Command): void {
  program
    .command("init")
    .description("Create the journal directory structure and default config.")
    .option("-f, --force", "overwrite generated templates when supported")
    .action(() => {
      console.log("englog init is planned for M1.");
    });
}
