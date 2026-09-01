import { describe, expect, it } from "vitest";
import { splitOversizedBlock } from "../src/split.js";
import { defaultCountTokens } from "../src/tokenizer.js";
import type { RawBlock } from "../src/types.js";

function block(type: string, raw: string): RawBlock {
  return { type, raw, headingPath: [], startLine: 1, endLine: 1 };
}

describe("splitOversizedBlock", () => {
  it("splits an oversized code block into fence-wrapped pieces, preserving every line", () => {
    const lines = Array.from({ length: 20 }, (_, i) => `line_${i} = ${i};`);
    const raw = ["```js", ...lines, "```"].join("\n");

    const pieces = splitOversizedBlock(block("code", raw), 20, defaultCountTokens);

    expect(pieces.length).toBeGreaterThan(1);
    for (const piece of pieces) {
      expect(piece.startsWith("```js")).toBe(true);
      expect(piece.trimEnd().endsWith("```")).toBe(true);
    }
    const joined = pieces.join("\n");
    for (const line of lines) {
      expect(joined).toContain(line);
    }
  });

  it("leaves a code block that already fits under the limit as a single piece", () => {
    const raw = "```js\nconst x = 1;\n```";
    const pieces = splitOversizedBlock(block("code", raw), 500, defaultCountTokens);
    expect(pieces).toEqual([raw]);
  });

  it("handles a code fence with no closing marker without dropping lines", () => {
    const raw = "```js\nconst a = 1;\nconst b = 2;";
    const pieces = splitOversizedBlock(block("code", raw), 5, defaultCountTokens);
    const joined = pieces.join("\n");
    expect(joined).toContain("const a = 1;");
    expect(joined).toContain("const b = 2;");
  });

  it("splits an oversized table by rows, repeating the header and separator", () => {
    const header = "| a | b |";
    const sep = "| --- | --- |";
    const rows = Array.from({ length: 10 }, (_, i) => `| r${i} | v${i} |`);
    const raw = [header, sep, ...rows].join("\n");

    const pieces = splitOversizedBlock(block("table", raw), 20, defaultCountTokens);

    expect(pieces.length).toBeGreaterThan(1);
    for (const piece of pieces) {
      expect(piece.startsWith(header)).toBe(true);
      expect(piece).toContain(sep);
    }
    const joined = pieces.join("\n");
    for (const row of rows) {
      expect(joined).toContain(row);
    }
  });

  it("leaves a too-small table (no data rows) untouched", () => {
    const raw = "| a | b |\n| --- | --- |";
    const pieces = splitOversizedBlock(block("table", raw), 1, defaultCountTokens);
    expect(pieces).toEqual([raw]);
  });

  it("splits oversized prose by sentence boundaries", () => {
    const raw = "One sentence here. Two sentence here. Three sentence here. Four sentence here.";
    const pieces = splitOversizedBlock(block("paragraph", raw), 10, defaultCountTokens);
    expect(pieces.length).toBeGreaterThan(1);
    expect(pieces.join(" ")).toContain("One sentence here.");
    expect(pieces.join(" ")).toContain("Four sentence here.");
  });

  it("falls back to the whole text when prose has no sentence boundaries", () => {
    const raw = "wordwordwordwordwordwordwordwordwordwordwordwordword";
    const pieces = splitOversizedBlock(block("paragraph", raw), 2, defaultCountTokens);
    expect(pieces).toEqual([raw]);
  });
});
