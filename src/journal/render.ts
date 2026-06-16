import matter from "gray-matter";
import type { JournalEvent } from "../storage/events.js";
import type { JournalPeriod } from "../storage/journals.js";
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

export interface PeriodSource {
  key: string;
  markdown: string;
}

export interface RenderPeriodInput {
  period: Exclude<JournalPeriod, "daily">;
  key: string;
  label: string;
  sourcePeriod: JournalPeriod;
  sources: PeriodSource[];
  missingSourceKeys: string[];
  missingHint: string;
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
  const tags = unique(input.events.flatMap((event) => event.tags));
  const insertions = input.events.reduce((total, event) => total + event.diffStats.insertions, 0);
  const deletions = input.events.reduce((total, event) => total + event.diffStats.deletions, 0);
  const diffCollections = input.events
    .map((event) => event.diffCollection)
    .filter((collection): collection is NonNullable<JournalEvent["diffCollection"]> => Boolean(collection));

  return [
    "## 今日提交",
    "",
    commits.length === 0
      ? "- 暂无提交。"
      : commits.map((commit) => `- \`${commit.hash.slice(0, 7)}\` ${renderCommitSource(commit)}${commit.message} (${commit.authorName}, ${commit.date})`).join("\n"),
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
    renderDiffCollectionInfo(diffCollections),
    tags.length === 0 ? "- 标签：无" : `- 标签：${tags.join(", ")}`,
    changedFiles.length === 0 ? "- 变更文件：无" : `- 变更文件：${changedFiles.join(", ")}`,
    renderManualWarning(input.existingMarkdown)
  ]
    .filter((line) => line !== undefined)
    .join("\n");
}

function renderCommitSource(commit: JournalEvent["commits"][number]): string {
  return commit.repo ? `[${commit.repo}] ` : "";
}

function renderDiffCollectionInfo(collections: NonNullable<JournalEvent["diffCollection"]>[]): string {
  if (collections.length === 0) {
    return "- Diff 采集：未启用";
  }

  const truncated = collections.some((collection) => collection.truncated);
  const excludedCount = unique(collections.flatMap((collection) => collection.excludedFiles)).length;
  const maxDiffChars = Math.max(...collections.map((collection) => collection.maxDiffChars));

  return `- Diff 采集：已启用，最大 ${maxDiffChars} 字符，排除 ${excludedCount} 个文件，截断：${truncated ? "是" : "否"}`;
}

export function renderPeriodSummary(input: RenderPeriodInput): string {
  const autoSection = renderPeriodAutoSection(input);

  if (input.existingMarkdown) {
    return replaceAutoSection(input.existingMarkdown, autoSection);
  }

  const body = input.templateMarkdown
    ? renderPeriodTemplate(input.templateMarkdown, input.key, input.label)
    : defaultPeriodTemplate(input.period, input.label);

  return replaceAutoSection(body, autoSection);
}

export function renderPeriodAutoSection(input: RenderPeriodInput): string {
  const sourceLinks =
    input.sources.length === 0
      ? "- 暂无可用低层总结。"
      : input.sources.map((source) => `- ${source.key}`).join("\n");

  const completedList = input.sources
    .flatMap((source) => extractListItemsFromSections(source.markdown, ["今日提交", "主要变化", "本周完成", "重要工程进展", "阶段完成"]))
    .slice(0, 20);

  const progressList = input.sources
    .flatMap((source) => extractListItemsFromSections(source.markdown, ["主要变化", "重要工程进展"]))
    .slice(0, 10);

  const valuableList = input.sources
    .flatMap((source) => extractListItemsFromSections(source.markdown, ["有价值的部分", "最有价值的提交", "代表性价值"]))
    .slice(0, 8);

  const highlightsList = input.sources
    .flatMap((source) => extractListItemsFromSections(source.markdown, ["技术亮点", "技术亮点 / 创新点"]))
    .slice(0, 8);

  const decisionsList = input.sources
    .flatMap((source) => extractListItemsFromSections(source.markdown, ["关键工程判断", "工程判断"]))
    .slice(0, 8);

  const problemsList = input.sources
    .flatMap((source) => extractListItemsFromSections(source.markdown, ["问题与风险", "反复出现的问题"]))
    .slice(0, 8);

  const sections = periodSections(input.period);

  return [
    sections.completed,
    "",
    renderList(completedList, "- 暂无自动归纳。"),
    "",
    sections.progress,
    "",
    renderList(progressList, "- 待人工补充。"),
    "",
    sections.valuable,
    "",
    renderList(valuableList, "- 待人工补充。"),
    "",
    "## 技术亮点",
    "",
    renderList(highlightsList, "- 待人工补充。"),
    "",
    "## 关键工程判断",
    "",
    renderList(decisionsList, "- 待人工补充。"),
    "",
    "## AI 协作复盘",
    "",
    "- 待人工补充。",
    "",
    sections.problems,
    "",
    renderList(problemsList, "- 待人工补充。"),
    "",
    sections.next,
    "",
    "- 待人工补充。",
    "",
    sections.thinking,
    "",
    "- 待人工补充。",
    "",
    "## 来源摘要",
    "",
    sourceLinks,
    input.missingSourceKeys.length === 0
      ? "- 缺失来源：无"
      : `- 缺失来源：${input.missingSourceKeys.join(", ")}。${input.missingHint}。`,
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

function defaultPeriodTemplate(period: Exclude<JournalPeriod, "daily">, label: string): string {
  return matter.stringify(
    [
      `# ${periodTitle(period)} ${label}`,
      "",
      AUTO_START,
      AUTO_END,
      "",
      MANUAL_START,
      "## 人工记录",
      "",
      "### 复盘补充",
      "",
      "### 后续关注",
      "",
      MANUAL_END,
      ""
    ].join("\n"),
    {
      period: label,
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

function renderPeriodTemplate(templateMarkdown: string, key: string, label: string): string {
  const rendered = templateMarkdown.replaceAll("{{period}}", label).replaceAll("{{key}}", key);

  if (!rendered.includes(AUTO_START) || !rendered.includes(AUTO_END)) {
    throw new Error("Period template must include englog auto markers.");
  }

  if (!rendered.includes(MANUAL_START) || !rendered.includes(MANUAL_END)) {
    throw new Error("Period template must include englog manual markers.");
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

function extractListItems(markdown: string): string[] {
  return markdown
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith("- ") && !line.includes("待人工补充") && !line.includes("暂无"))
    .map((line) => line.slice(2).trim())
    .filter(Boolean);
}

function extractListItemsFromSections(markdown: string, sectionTitles: string[]): string[] {
  const lines = markdown.split(/\r?\n/);
  const result: string[] = [];
  let inSection = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("#")) {
      inSection = sectionTitles.some((title) => trimmed.includes(title));
    } else if (inSection) {
      if (trimmed.startsWith("- ") && !trimmed.includes("待人工补充") && !trimmed.includes("暂无")) {
        const content = trimmed.slice(2).trim();
        if (content) {
          result.push(content);
        }
      }
    }
  }

  return result;
}

function periodTitle(period: Exclude<JournalPeriod, "daily">): string {
  switch (period) {
    case "weekly":
      return "Weekly Engineering Journal";
    case "monthly":
      return "Monthly Engineering Journal";
    case "quarterly":
      return "Quarterly Engineering Journal";
    case "half-year":
      return "Half-Year Engineering Journal";
    case "yearly":
      return "Yearly Engineering Journal";
  }
}

function periodSections(period: Exclude<JournalPeriod, "daily">): {
  completed: string;
  progress: string;
  valuable: string;
  problems: string;
  next: string;
  thinking: string;
} {
  if (period === "weekly") {
    return {
      completed: "## 本周完成",
      progress: "## 重要工程进展",
      valuable: "## 最有价值的提交",
      problems: "## 反复出现的问题",
      next: "## 下周方向",
      thinking: "## 本周思考"
    };
  }

  return {
    completed: "## 阶段完成",
    progress: "## 重要工程进展",
    valuable: "## 代表性价值",
    problems: "## 反复出现的问题",
    next: "## 下一阶段方向",
    thinking: "## 阶段思考"
  };
}
