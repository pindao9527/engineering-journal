import matter from "gray-matter";
import type { JournalEvent } from "../storage/events.js";

export interface RenderDailyInput {
  date: string;
  events: JournalEvent[];
}

export function renderDaily(input: RenderDailyInput): string {
  const body = [
    `# Engineering Journal ${input.date}`,
    "",
    "<!-- englog:auto:start -->",
    "## 今日提交",
    "",
    input.events.length === 0 ? "- 暂无自动采集事件。" : `- 已采集 ${input.events.length} 个事件。`,
    "",
    "<!-- englog:auto:end -->",
    "",
    "<!-- englog:manual:start -->",
    "## 人工记录",
    "",
    "<!-- englog:manual:end -->",
    ""
  ].join("\n");

  return matter.stringify(body, {
    date: input.date,
    schemaVersion: 1
  });
}
