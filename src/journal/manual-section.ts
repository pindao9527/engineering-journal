export const AUTO_START = "<!-- englog:auto:start -->";
export const AUTO_END = "<!-- englog:auto:end -->";
export const MANUAL_START = "<!-- englog:manual:start -->";
export const MANUAL_END = "<!-- englog:manual:end -->";

export function extractManualSection(markdown: string): string | undefined {
  return extractMarkedSection(markdown, MANUAL_START, MANUAL_END);
}

export function replaceAutoSection(markdown: string, nextAutoSection: string): string {
  const startIndex = markdown.indexOf(AUTO_START);
  const endIndex = markdown.indexOf(AUTO_END);

  if (startIndex === -1 || endIndex === -1 || endIndex < startIndex) {
    throw new Error("Cannot replace auto section because englog auto markers are invalid.");
  }

  return [
    markdown.slice(0, startIndex + AUTO_START.length),
    "\n",
    nextAutoSection.trim(),
    "\n",
    markdown.slice(endIndex)
  ].join("");
}

function extractMarkedSection(markdown: string, startMarker: string, endMarker: string): string | undefined {
  const startIndex = markdown.indexOf(startMarker);
  const endIndex = markdown.indexOf(endMarker);

  if (startIndex === -1 || endIndex === -1 || endIndex < startIndex) {
    return undefined;
  }

  return markdown.slice(startIndex + startMarker.length, endIndex).trim();
}
