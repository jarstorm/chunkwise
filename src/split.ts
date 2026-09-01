import type { RawBlock, TokenCounter } from "./types.js";

/**
 * Splits an oversized fenced code block by lines, re-wrapping each piece in
 * the same fence. Tracks a running token sum (one countTokens call per line)
 * instead of re-tokenizing the whole accumulated candidate on every line —
 * re-tokenizing there is O(n^2) tokenizer work for an n-line block.
 */
function splitCodeBlock(raw: string, maxTokens: number, countTokens: TokenCounter): string[] {
  const lines = raw.split("\n");
  const fenceLine = lines[0];
  const lastLine = lines[lines.length - 1];
  const hasClosingFence = lastLine.trim().startsWith("```") || lastLine.trim().startsWith("~~~");
  const body = hasClosingFence ? lines.slice(1, -1) : lines.slice(1);
  const closeFence = hasClosingFence ? lastLine : fenceLine.slice(0, 3);
  const overhead = countTokens(`${fenceLine}\n${closeFence}`);

  const pieces: string[] = [];
  let current: string[] = [];
  let currentTokens = overhead;

  for (const line of body) {
    const lineTokens = countTokens(`${line}\n`);
    if (current.length && currentTokens + lineTokens > maxTokens) {
      pieces.push([fenceLine, ...current, closeFence].join("\n"));
      current = [line];
      currentTokens = overhead + lineTokens;
    } else {
      current.push(line);
      currentTokens += lineTokens;
    }
  }
  if (current.length) {
    pieces.push([fenceLine, ...current, closeFence].join("\n"));
  }
  return pieces.length ? pieces : [raw];
}

/**
 * Splits an oversized GFM table by rows, repeating the header + separator
 * row in every piece. Same running-sum approach as splitCodeBlock, to avoid
 * O(n^2) re-tokenization for a table with many rows.
 */
function splitTableBlock(raw: string, maxTokens: number, countTokens: TokenCounter): string[] {
  const lines = raw.split("\n").filter((line) => line.length > 0);
  if (lines.length < 3) return [raw];
  const [header, separator, ...rows] = lines;
  const overhead = countTokens(`${header}\n${separator}`);

  const pieces: string[] = [];
  let current: string[] = [];
  let currentTokens = overhead;

  for (const row of rows) {
    const rowTokens = countTokens(`${row}\n`);
    if (current.length && currentTokens + rowTokens > maxTokens) {
      pieces.push([header, separator, ...current].join("\n"));
      current = [row];
      currentTokens = overhead + rowTokens;
    } else {
      current.push(row);
      currentTokens += rowTokens;
    }
  }
  if (current.length) {
    pieces.push([header, separator, ...current].join("\n"));
  }
  return pieces.length ? pieces : [raw];
}

/**
 * Splits raw text into sentence-ish pieces on a `.`/`!`/`?` that is followed
 * by whitespace (or end of string) — so a period inside a decimal, version
 * number, abbreviation, or inline code span (`0.0.0.0`, `v1.2.3`) is never
 * mistaken for a boundary, since nothing but whitespace follows it there.
 * Built by scanning for boundaries and slicing between them, rather than a
 * `.match(/.../g)` that returns only the substrings its pattern matches: a
 * global match silently *drops* any character it skips over between matches,
 * which — with a pattern this fiddly — is exactly what happened before: text
 * like "0.0.0.0" got eaten instead of just misplaced. Slicing guarantees
 * every character of `raw` lands in exactly one returned piece.
 */
function splitIntoSentences(raw: string): string[] {
  const boundary = /[.!?](?=\s|$)\s*/g;
  const sentences: string[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = boundary.exec(raw))) {
    sentences.push(raw.slice(lastIndex, boundary.lastIndex));
    lastIndex = boundary.lastIndex;
  }
  if (lastIndex < raw.length) sentences.push(raw.slice(lastIndex));
  return sentences.length ? sentences : [raw];
}

/**
 * Last-resort split for oversized prose: by sentence, falling back to whole
 * text if no boundary found. Same running-sum approach as splitCodeBlock.
 */
function splitTextBlock(raw: string, maxTokens: number, countTokens: TokenCounter): string[] {
  const sentences = splitIntoSentences(raw);
  const pieces: string[] = [];
  let current = "";
  let currentTokens = 0;

  for (const sentence of sentences) {
    const sentenceTokens = countTokens(sentence);
    if (current && currentTokens + sentenceTokens > maxTokens) {
      pieces.push(current.trim());
      current = sentence;
      currentTokens = sentenceTokens;
    } else {
      current += sentence;
      currentTokens += sentenceTokens;
    }
  }
  if (current.trim()) pieces.push(current.trim());
  return pieces.length ? pieces : [raw];
}

/**
 * Splits a single block that alone exceeds maxTokens. Used only as a last
 * resort — normal packing never splits an atomic block that fits the limit.
 */
export function splitOversizedBlock(block: RawBlock, maxTokens: number, countTokens: TokenCounter): string[] {
  switch (block.type) {
    case "code":
      return splitCodeBlock(block.raw, maxTokens, countTokens);
    case "table":
      return splitTableBlock(block.raw, maxTokens, countTokens);
    default:
      return splitTextBlock(block.raw, maxTokens, countTokens);
  }
}
