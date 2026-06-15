import type { AnalysisConfig } from "../config/load-config.js";
import type { JournalAnalysis, JournalEvent } from "../storage/events.js";

interface ChatCompletionResponse {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
}

interface ResponsesApiResponse {
  output_text?: string;
  output?: Array<{
    content?: Array<{
      type?: string;
      text?: string;
    }>;
  }>;
}

const ANALYSIS_FIELDS = [
  "summary",
  "valuableChanges",
  "technicalHighlights",
  "decisions",
  "risks",
  "tests",
  "aiAssistedParts",
  "humanReviewNotes"
] as const;

interface AnalysisModelOutput extends Partial<JournalAnalysis> {
  tags?: unknown;
}

export interface EventAnalysisResult {
  analysis: JournalAnalysis;
  tags: string[];
}

export async function analyzeEventWithOpenAICompatibleApi(
  event: JournalEvent,
  config: AnalysisConfig | undefined
): Promise<EventAnalysisResult> {
  if (!config?.enabled) {
    return {
      analysis: event.analysis,
      tags: event.tags
    };
  }

  if (config.provider && config.provider !== "openai-compatible") {
    throw new Error(`Unsupported analysis provider: ${config.provider}`);
  }

  const api = config.api ?? "responses";
  const baseUrl = config.baseUrl ?? "https://api.openai.com/v1";
  const model = config.model ?? "gpt-5.5";
  const apiKey = config.apiKeyEnv ? process.env[config.apiKeyEnv] : undefined;
  const headers: Record<string, string> = {
    "content-type": "application/json"
  };

  if (apiKey) {
    headers.authorization = `Bearer ${apiKey}`;
  }

  const response = await fetch(endpointUrl(baseUrl, api), {
    method: "POST",
    headers,
    body: JSON.stringify(requestBody(api, model, event, config.temperature ?? 0.2))
  });

  if (!response.ok) {
    throw new Error(`OpenAI-compatible analysis failed: ${response.status} ${await response.text()}`);
  }

  const completion = await response.json();
  const content = api === "responses"
    ? responsesContent(completion as ResponsesApiResponse)
    : chatCompletionContent(completion as ChatCompletionResponse);
  if (!content) {
    throw new Error("OpenAI-compatible analysis returned no text content.");
  }

  const parsed = parseAnalysisJson(content);

  return {
    analysis: normalizeAnalysis({
      ...event.analysis,
      ...parsed
    }),
    tags: normalizeTags([...event.tags, ...stringArray(parsed.tags)])
  };
}

function endpointUrl(baseUrl: string, api: "responses" | "chat-completions"): string {
  const normalized = baseUrl.replace(/\/+$/, "");
  if (normalized.endsWith("/responses") || normalized.endsWith("/chat/completions")) {
    return normalized;
  }

  return api === "responses" ? `${normalized}/responses` : `${normalized}/chat/completions`;
}

function requestBody(api: "responses" | "chat-completions", model: string, event: JournalEvent, temperature: number): object {
  const instructions = [
    "你是 engineering-journal 的工程日志分析器。",
    "只输出严格 JSON，不要 Markdown，不要代码块。",
    "所有字段都必须是字符串数组，内容要基于提交、文件和验证事实，避免泛泛总结。",
    "如果输入包含 diff，请基于代码变化判断工程价值、风险、测试信号和关键取舍，不要只复述 commit message。",
    "区分确定事实和合理推测；diff 缺失、被排除或被截断时，应降低判断置信度。",
    "不要输出源码片段或 patch 原文，只输出工程归纳。"
  ].join("\n");
  const input = JSON.stringify(toAnalysisPayload(event), null, 2);

  if (api === "responses") {
    return {
      model,
      temperature,
      instructions,
      input
    };
  }

  return {
    model,
    temperature,
    messages: [
      {
        role: "system",
        content: instructions
      },
      {
        role: "user",
        content: input
      }
    ]
  };
}

function responsesContent(response: ResponsesApiResponse): string | undefined {
  if (response.output_text) {
    return response.output_text;
  }

  return response.output
    ?.flatMap((item) => item.content ?? [])
    .find((content) => content.type === "output_text" || content.text)
    ?.text;
}

function chatCompletionContent(response: ChatCompletionResponse): string | undefined {
  return response.choices?.[0]?.message?.content;
}

function toAnalysisPayload(event: JournalEvent): object {
  return {
    date: event.date,
    repo: event.repo,
    branch: event.branch,
    commits: event.commits.map((commit) => ({
      hash: commit.hash.slice(0, 12),
      message: commit.message,
      authorName: commit.authorName,
      date: commit.date,
      filesChanged: commit.filesChanged,
      insertions: commit.insertions,
      deletions: commit.deletions,
      changedFiles: commit.changedFiles,
      diff: commit.diff
        ? {
            included: commit.diff.included,
            truncated: commit.diff.truncated,
            omittedReason: commit.diff.omittedReason,
            files: commit.diff.files.map((file) => ({
              path: file.path,
              insertions: file.insertions,
              deletions: file.deletions,
              truncated: file.truncated,
              omittedReason: file.omittedReason,
              patch: file.patch
            }))
          }
        : undefined
    })),
    changedFiles: event.changedFiles,
    diffStats: event.diffStats,
    diffCollection: event.diffCollection,
    existingRuleBasedAnalysis: event.analysis,
    existingTags: event.tags,
    expectedJsonShape: {
      ...Object.fromEntries(ANALYSIS_FIELDS.map((field) => [field, ["string"]])),
      tags: ["string"]
    }
  };
}

function parseAnalysisJson(content: string): AnalysisModelOutput {
  const trimmed = content.trim();
  const withoutFence = trimmed
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  try {
    return JSON.parse(withoutFence) as AnalysisModelOutput;
  } catch (error) {
    throw new Error(`OpenAI-compatible analysis returned invalid JSON: ${error instanceof Error ? error.message : error}`);
  }
}

function normalizeAnalysis(value: Partial<JournalAnalysis>): JournalAnalysis {
  return {
    summary: stringArray(value.summary),
    valuableChanges: stringArray(value.valuableChanges),
    technicalHighlights: stringArray(value.technicalHighlights),
    decisions: stringArray(value.decisions),
    risks: stringArray(value.risks),
    tests: stringArray(value.tests),
    aiAssistedParts: stringArray(value.aiAssistedParts),
    humanReviewNotes: stringArray(value.humanReviewNotes)
  };
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function normalizeTags(tags: string[]): string[] {
  return [...new Set(tags.map((tag) => tag.trim().toLowerCase()).filter(Boolean))].sort((a, b) => a.localeCompare(b));
}
