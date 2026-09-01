export interface RawBlock {
  /** mdast node type: paragraph, code, table, list, blockquote, thematicBreak, html, etc. */
  type: string;
  /** Verbatim source text for this block (exact slice, no re-serialization). */
  raw: string;
  /** Breadcrumb of enclosing headings, root to leaf, e.g. ["Setup", "Install"]. */
  headingPath: string[];
  startLine: number;
  endLine: number;
}

export interface Chunk {
  /** Chunk body, optionally prefixed with the heading breadcrumb. */
  text: string;
  tokens: number;
  headingPath: string[];
  startLine: number;
  endLine: number;
  /** Distinct mdast block types included in this chunk. */
  types: string[];
}

export type TokenCounter = (text: string) => number;

export interface ChunkOptions {
  /** Target max tokens per chunk. @default 500 */
  maxTokens?: number;
  /** Trailing tokens repeated at the start of the next chunk for recall at boundaries. @default 0 */
  overlapTokens?: number;
  /** Custom token counter, e.g. a model-specific tokenizer. Defaults to a cl100k-style counter. */
  countTokens?: TokenCounter;
  /** Prefix each chunk's text with its heading breadcrumb. @default true */
  includeHeadingPath?: boolean;
}
