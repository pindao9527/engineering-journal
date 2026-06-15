import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import type { Command } from "commander";
import { loadConfig } from "../config/load-config.js";
import { readAllJournalEventFiles, type JournalEvent } from "../storage/events.js";
import type { JournalPeriod } from "../storage/journals.js";

export interface SearchCommandOptions {
  limit?: string;
}

interface SearchDocument {
  type: "event" | JournalPeriod;
  key: string;
  file: string;
  tags: string[];
  text: string;
}

export function registerSearchCommand(program: Command): void {
  program
    .command("search")
    .description("Search engineering journal events and Markdown summaries.")
    .argument("<terms...>", "keywords to search for")
    .option("--limit <count>", "maximum number of results", "20")
    .action(async (terms: string[], options: SearchCommandOptions) => {
      console.log(await runSearch(terms, options));
    });
}

export async function runSearch(terms: string[], options: SearchCommandOptions = {}): Promise<string> {
  const config = await loadConfig();
  const normalizedTerms = terms.map((term) => term.trim().toLowerCase()).filter(Boolean);
  if (normalizedTerms.length === 0) {
    throw new Error("Search requires at least one keyword.");
  }

  const limit = parsePositiveInteger(options.limit ?? "20", "limit");
  const documents = await readSearchDocuments(config.journalRoot);
  const results = documents
    .map((document) => ({ document, score: scoreDocument(document.text, normalizedTerms) }))
    .filter((result) => result.score > 0)
    .sort((a, b) => b.score - a.score || a.document.key.localeCompare(b.document.key))
    .slice(0, limit);

  if (results.length === 0) {
    return [`query: ${normalizedTerms.join(" ")}`, "results: 0"].join("\n");
  }

  return [
    `query: ${normalizedTerms.join(" ")}`,
    `results: ${results.length}`,
    ...results.map(({ document, score }) =>
      [
        `- ${document.key} [${document.type}] ${path.relative(config.journalRoot, document.file)}`,
        `  score: ${score}`,
        `  tags: ${document.tags.length > 0 ? document.tags.join(", ") : "none"}`,
        `  matched: ${matchedTerms(document.text, normalizedTerms).join(", ")}`
      ].join("\n")
    )
  ].join("\n");
}

async function readSearchDocuments(root: string): Promise<SearchDocument[]> {
  const eventDocuments = (await readAllJournalEventFiles(root)).map((file) => eventToDocument(file.path, file.event));
  const journalDocuments = await readJournalDocuments(root);

  return [...eventDocuments, ...journalDocuments];
}

function eventToDocument(file: string, event: JournalEvent): SearchDocument {
  return {
    type: "event",
    key: event.date,
    file,
    tags: event.tags,
    text: JSON.stringify(event)
  };
}

async function readJournalDocuments(root: string): Promise<SearchDocument[]> {
  const periods: JournalPeriod[] = ["daily", "weekly", "monthly", "quarterly", "half-year", "yearly"];
  const documents = await Promise.all(
    periods.map(async (period) => {
      const directory = path.join(root, "journals", period);
      try {
        const entries = await readdir(directory, { withFileTypes: true });
        return Promise.all(
          entries
            .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
            .sort((a, b) => a.name.localeCompare(b.name))
            .map(async (entry) => {
              const file = path.join(directory, entry.name);
              return {
                type: period,
                key: entry.name.replace(/\.md$/, ""),
                file,
                tags: [],
                text: await readFile(file, "utf8")
              };
            })
        );
      } catch (error) {
        if (isNodeError(error) && error.code === "ENOENT") {
          return [];
        }
        throw error;
      }
    })
  );

  return documents.flat();
}

function scoreDocument(text: string, terms: string[]): number {
  const normalizedText = text.toLowerCase();
  return terms.reduce((score, term) => score + countOccurrences(normalizedText, term), 0);
}

function matchedTerms(text: string, terms: string[]): string[] {
  const normalizedText = text.toLowerCase();
  return terms.filter((term) => normalizedText.includes(term));
}

function countOccurrences(text: string, term: string): number {
  let count = 0;
  let index = text.indexOf(term);

  while (index !== -1) {
    count += 1;
    index = text.indexOf(term, index + term.length);
  }

  return count;
}

function parsePositiveInteger(value: string, name: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(`Invalid ${name}: ${value}. Expected a positive integer.`);
  }
  return parsed;
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}
