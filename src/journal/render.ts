import matter from "gray-matter";
import type { JournalEvent } from "../storage/events.js";
import {
  AUTO_END,
  AUTO_START,
  MANUAL_END,
  MANUAL_START,
  hasManualMarkers,
  replaceAutoSection
} from "./manual-section.js";

export interface RenderDailyInput {
  date: string;
  events: JournalEvent[];
  existingMarkdown?: string;
  templateMarkdown?: string;
}

export function renderDaily(input: RenderDailyInput): string {
  const autoSection = renderDailyAutoSection(input);

  if (input.existingMarkdown) {
    return replaceAutoSection(input.existingMarkdown, autoSection);
  }

  const body = input.templateMarkdown ? renderTemplate(input.templateMarkdown, input.date) : defaultDailyTemplate(input.date);
  return replaceAutoSection(body, autoSection);
}

export function renderDailyAutoSection(input: RenderDailyInput): string {
  const commits = input.events.flatMap((event) => event.commits);
  const changedFiles = unique(input.events.flatMap((event) => event.changedFiles));
  const summary = input.events.flatMap((event) => event.analysis.summary).filter(Boolean);
  const valuableChanges = input.events.flatMap((event) => event.analysis.valuableChanges);
  const technicalHighlights = input.events.flatMap((event) => event.analysis.technicalHighlights);
  const decisions = input.events.flatMap((event) => event.analysis.decisions);
  const risks = input.events.flatMap((event) => event.analysis.risks);
  const tests = input.events.flatMap((event) => event.analysis.tests);
  const aiAssistedParts = input.events.flatMap((event) => event.analysis.aiAssistedParts);
  const humanReviewNotes = input.events.flatMap((event) => event.analysis.humanReviewNotes);
  const insertions = input.events.reduce((total, event) => total + event.diffStats.insertions, 0);
  const deletions = input.events.reduce((total, event) => total + event.diffStats.deletions, 0);

  return [
    "## 今日提交",
    "",
    commits.length === 0
      ? "- 暂无提交。"
      : commits.map((commit) => `- \`${commit.hash.slice(0, 7)}\` ${commit.message} (${commit.authorName}, ${commit.date})`).join("\n"),
    "",
    "## 主要变化",
    "",
    renderList(summary.length > 0 ? summary : changedFiles.map((file) => `修改 ${file}`), "- 暂无自动归纳。"),
    "",
    "## 有价值的部分",
    "",
    renderList(valuableChanges, "- 待人工补充。"),
    "",
    "## 技术亮点 / 创新点",
    "",
    renderList(technicalHighlights, "- 待人工补充。"),
    "",
    "## 关键工程判断",
    "",
    renderList(decisions, "- 待人工补充。"),
    "",
    "## AI 参与与人工审查",
    "",
    renderList([...aiAssistedParts, ...humanReviewNotes], "- 待人工补充。"),
    "",
    "## 测试与验证",
    "",
    renderList(unique(tests), "- 待补充验证方式。"),
    "",
    "## 问题与风险",
    "",
    renderList(risks, "- 暂无自动识别风险。"),
    "",
    "## 明日可继续推进",
    "",
    "- 待人工补充。",
    "",
    "## 采集信息",
    "",
    `- 事件数：${input.events.length}`,
    `- 提交数：${commits.length}`,
    `- 变更文件数：${changedFiles.length}`,
    `- 新增/删除：+${insertions} / -${deletions}`,
    changedFiles.length === 0 ? "- 变更文件：无" : `- 变更文件：${changedFiles.join(", ")}`,
    renderManualWarning(input.existingMarkdown)
  ]
    .filter((line) => line !== undefined)
    .join("\n");
}

function defaultDailyTemplate(date: string): string {
  return matter.stringify(
    [
      `# Engineering Journal ${date}`,
      "",
      AUTO_START,
      AUTO_END,
      "",
      MANUAL_START,
      "## 人工记录",
      "",
      "### 今日反思",
      "",
      "### 工程判断",
      "",
      "### 明日关注",
      "",
      MANUAL_END,
      ""
    ].join("\n"),
    {
      date,
      schemaVersion: 1
    }
  );
}

function renderTemplate(templateMarkdown: string, date: string): string {
  const rendered = templateMarkdown.replaceAll("{{date}}", date);

  if (!rendered.includes(AUTO_START) || !rendered.includes(AUTO_END)) {
    throw new Error("Daily template must include englog auto markers.");
  }

  if (!rendered.includes(MANUAL_START) || !rendered.includes(MANUAL_END)) {
    throw new Error("Daily template must include englog manual markers.");
  }

  return rendered;
}

function renderManualWarning(existingMarkdown: string | undefined): string | undefined {
  if (!existingMarkdown || hasManualMarkers(existingMarkdown)) {
    return undefined;
  }

  return "> 注意：原日报缺少有效人工区标记，englog 仅替换自动区，原文其余部分已保留。";
}

function renderList(items: string[], emptyText: string): string {
  const normalized = unique(items.map((item) => item.trim()).filter(Boolean));

  if (normalized.length === 0) {
    return emptyText;
  }

  return normalized.map((item) => `- ${item}`).join("\n");
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}
