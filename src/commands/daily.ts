import type { Command } from "commander";

export interface DailyCommandOptions {
  date?: string;
  repo?: string;
  git: boolean;
  sync?: boolean;
}

export function registerDailyCommand(program: Command): void {
  program
    .command("daily")
    .description("Collect today's Git activity and render a daily journal.")
    .option("--date <date>", "journal date in yyyy-MM-dd format")
    .option("--repo <path>", "Git repository path to inspect")
    .option("--no-git", "skip Git collection and render an empty journal")
    .option("--sync", "pull, collect, render, commit, and push when supported")
    .action((options: DailyCommandOptions) => {
      const datePart = options.date ? ` for ${options.date}` : "";
      console.log(`englog daily${datePart} is planned for M1.`);
    });
}
