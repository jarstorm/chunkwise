import { parseBlocks } from "./parse.js";
import { splitOversizedBlock } from "./split.js";
import { defaultCountTokens } from "./tokenizer.js";
import type { Chunk, ChunkOptions, RawBlock, TokenCounter } from "./types.js";

function headingKey(path: string[]): string {
  return path.join(" > ");
}

function joinRaw(blocks: RawBlock[]): string {
  return blocks.map((block) => block.raw).join("\n\n");
}

function withHeadingPrefix(body: string, headingPath: string[], includeHeadingPath: boolean): string {
  if (!includeHeadingPath || headingPath.length === 0) return body;
  return `${headingPath.join(" > ")}\n\n${body}`;
}

function trailingOverlap(text: string, overlapTokens: number, countTokens: TokenCounter): string {
  if (overlapTokens <= 0 || !text) return "";
  const words = text.split(/\s+/).filter(Boolean);
  let acc = "";
  for (let i = words.length - 1; i >= 0; i--) {
    const candidate = acc ? `${words[i]} ${acc}` : words[i];
    if (countTokens(candidate) > overlapTokens) break;
    acc = candidate;
  }
  return acc;
}

/**
 * Chunks a Markdown document for RAG ingestion: packs blocks greedily up to
 * maxTokens without ever splitting an atomic block (code fence, table) that
 * fits the limit on its own, and starts a new chunk whenever the heading
 * breadcrumb changes so every chunk stays under a single, coherent section.
 */
export function chunkMarkdown(source: string, options: ChunkOptions = {}): Chunk[] {
  const maxTokens = options.maxTokens ?? 500;
  const overlapTokens = options.overlapTokens ?? 0;
  const countTokens = options.countTokens ?? defaultCountTokens;
  const includeHeadingPath = options.includeHeadingPath ?? true;

  const blocks = parseBlocks(source);
  const chunks: Chunk[] = [];

  let current: RawBlock[] = [];
  let currentTokens = 0;
  let currentHeadingKey: string | null = null;
  let pendingOverlap = "";

  const flush = (): void => {
    if (!current.length) return;
    const headingPath = current[0].headingPath;
    const body = pendingOverlap ? `${pendingOverlap}\n\n${joinRaw(current)}` : joinRaw(current);
    const text = withHeadingPrefix(body, headingPath, includeHeadingPath);
    chunks.push({
      text,
      tokens: countTokens(text),
      headingPath,
      startLine: current[0].startLine,
      endLine: current[current.length - 1].endLine,
      types: [...new Set(current.map((block) => block.type))],
    });
    current = [];
    currentTokens = 0;
    pendingOverlap = "";
  };

  const startNewChunk = (): void => {
    const prevRaw = joinRaw(current);
    flush();
    pendingOverlap = trailingOverlap(prevRaw, overlapTokens, countTokens);
    currentTokens = pendingOverlap ? countTokens(pendingOverlap) : 0;
  };

  for (const block of blocks) {
    const key = headingKey(block.headingPath);

    if (currentHeadingKey !== null && key !== currentHeadingKey && current.length) {
      startNewChunk();
    }
    currentHeadingKey = key;

    const tokens = countTokens(block.raw);

    if (tokens > maxTokens) {
      if (current.length) startNewChunk();
      for (const piece of splitOversizedBlock(block, maxTokens, countTokens)) {
        const text = withHeadingPrefix(piece, block.headingPath, includeHeadingPath);
        chunks.push({
          text,
          tokens: countTokens(text),
          headingPath: block.headingPath,
          startLine: block.startLine,
          endLine: block.endLine,
          types: [block.type],
        });
      }
      continue;
    }

    if (current.length && currentTokens + tokens > maxTokens) {
      startNewChunk();
    }

    current.push(block);
    currentTokens += tokens;
  }

  flush();
  return chunks;
}
