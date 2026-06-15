import type { Command } from "commander";

export interface RenderCommandOptions {
  date?: string;
}

export function registerRenderCommand(program: Command): void {
  const render = program
    .command("render")
    .description("Render journal Markdown from stored event data.");

  render
    .command("daily")
    .description("Re-render a daily journal while preserving manual sections.")
    .option("--date <date>", "journal date in yyyy-MM-dd format")
    .action((options: RenderCommandOptions) => {
      const datePart = options.date ? ` for ${options.date}` : "";
      console.log(`englog render daily${datePart} is planned for M1.`);
    });
}
