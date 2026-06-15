import type { AnalysisConfig } from "../config/load-config.js";
import type { JournalEvent } from "../storage/events.js";
import { analyzeEventWithOpenAICompatibleApi, type EventAnalysisResult } from "./openai-compatible.js";

export async function analyzeJournalEvent(
  event: JournalEvent,
  config: AnalysisConfig | undefined
): Promise<EventAnalysisResult> {
  if (!config?.enabled) {
    return {
      analysis: event.analysis,
      tags: event.tags
    };
  }

  const provider = config.provider ?? "openai-compatible";

  switch (provider) {
    case "openai-compatible":
      return analyzeEventWithOpenAICompatibleApi(event, config);
  }
}
