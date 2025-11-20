const TIMESTAMP_REGEX = /^\s*(\[)?\d{1,2}:\d{2}(?::\d{2})?(\])?\s*/;

const NOISE_LINES = new Set([
  "[music]",
  "[applause]",
  "(music)",
  "(applause)",
]);

const MULTISPACE_REGEX = /\s+/g;

/**
 * Normalizes raw YouTube transcripts by stripping timestamps, filler cues, and redundant whitespace.
 * Gemini 2.5 can handle the full cleaned transcript (1M tokens), so we avoid chunking per user request.
 */
export function cleanTranscript(raw: string): string {
  if (!raw) {
    return "";
  }

  const cleanedLines = raw
    .split(/\r?\n/)
    .map((line) => line.replace(TIMESTAMP_REGEX, "").trim())
    .filter((line) => line.length > 0)
    .filter((line) => !NOISE_LINES.has(line.toLowerCase()))
    .map((line) => line.replace(MULTISPACE_REGEX, " "));

  return cleanedLines.join("\n").trim();
}
