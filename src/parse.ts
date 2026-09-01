import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkFrontmatter from "remark-frontmatter";
import { toString as mdastToString } from "mdast-util-to-string";
import type { RawBlock } from "./types.js";

// remark-gfm roughly doubles parse time (measured) to get structured table
// cells, task-list checkboxes, strikethrough, and autolinks — none of which
// this library uses, since blocks are kept as raw source slices rather than
// re-serialized from parsed inline content. The only gfm feature that
// affects block *boundaries* (what we do need) is GFM tables: without gfm,
// a table's lines have no blank line between them, so CommonMark groups
// them into a single "paragraph" node. isTableParagraph below reclassifies
// that node by pattern-matching the same header+separator-row shape gfm
// tables require, at a fraction of the cost.
//
// remark-frontmatter is needed for correctness, not boundaries: without it,
// a leading `---`-delimited YAML block has no special meaning to CommonMark,
// so its content lines merge into one paragraph and the closing `---` reads
// as a Setext heading underline — the whole front matter silently becomes a
// heading and gets folded into the breadcrumb by the loop below, vanishing
// from every chunk's output.
const processor = unified().use(remarkParse).use(remarkFrontmatter, ["yaml", "toml"]);

const TABLE_HEADER_ROW = /^\s*\|?.+\|.*\|?\s*$/;
const TABLE_SEPARATOR_ROW = /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)+\|?\s*$/;

function isTableParagraph(raw: string): boolean {
  const lines = raw.split("\n");
  return lines.length >= 2 && TABLE_HEADER_ROW.test(lines[0]) && TABLE_SEPARATOR_ROW.test(lines[1]);
}

interface HeadingFrame {
  depth: number;
  text: string;
}

/**
 * Parses Markdown into an ordered list of top-level blocks, each carrying
 * the exact source slice (no re-serialization) and the heading breadcrumb
 * it falls under. Headings themselves are folded into the breadcrumb, not
 * emitted as standalone blocks.
 */
export function parseBlocks(source: string): RawBlock[] {
  const tree = processor.parse(source) as unknown as {
    children: Array<{
      type: string;
      depth?: number;
      position?: {
        start: { line: number; offset?: number };
        end: { line: number; offset?: number };
      };
    }>;
  };

  const blocks: RawBlock[] = [];
  const stack: HeadingFrame[] = [];

  for (const node of tree.children) {
    if (!node.position || node.position.start.offset === undefined || node.position.end.offset === undefined) {
      continue;
    }

    if (node.type === "heading") {
      const depth = node.depth ?? 1;
      const text = mdastToString(node).trim();
      while (stack.length && stack[stack.length - 1].depth >= depth) {
        stack.pop();
      }
      stack.push({ depth, text });
      continue;
    }

    const raw = source.slice(node.position.start.offset, node.position.end.offset);
    const type = node.type === "paragraph" && isTableParagraph(raw) ? "table" : node.type;
    blocks.push({
      type,
      raw,
      headingPath: stack.map((frame) => frame.text),
      startLine: node.position.start.line,
      endLine: node.position.end.line,
    });
  }

  return blocks;
}
