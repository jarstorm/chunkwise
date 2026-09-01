import { describe, expect, it } from "vitest";
import { parseBlocks } from "../src/parse.js";

describe("parseBlocks", () => {
  it("returns no blocks for an empty document", () => {
    expect(parseBlocks("")).toEqual([]);
  });

  it("returns no blocks for a document with only headings", () => {
    const blocks = parseBlocks("# One\n## Two\n### Three");
    expect(blocks).toEqual([]);
  });

  it("attaches an empty heading path to content before any heading", () => {
    const blocks = parseBlocks("Intro paragraph.\n\n# First heading\n\nBody.");
    expect(blocks[0].headingPath).toEqual([]);
    expect(blocks[1].headingPath).toEqual(["First heading"]);
  });

  it("builds a nested breadcrumb across increasing heading depths", () => {
    const blocks = parseBlocks("# A\n\n## B\n\n### C\n\nleaf");
    expect(blocks[0].headingPath).toEqual(["A", "B", "C"]);
  });

  it("pops back to the right ancestor when depth decreases non-monotonically", () => {
    const source = ["# A", "", "## B", "", "### C", "", "leaf-1", "", "## D", "", "leaf-2"].join("\n");
    const blocks = parseBlocks(source);
    expect(blocks[0].headingPath).toEqual(["A", "B", "C"]);
    expect(blocks[1].headingPath).toEqual(["A", "D"]);
  });

  it("handles a heading depth jump (H1 straight to H3)", () => {
    const source = ["# A", "", "### C", "", "leaf"].join("\n");
    const blocks = parseBlocks(source);
    expect(blocks[0].headingPath).toEqual(["A", "C"]);
  });

  it("resets the breadcrumb for a sibling top-level heading", () => {
    const source = ["# A", "", "## B", "", "leaf-1", "", "# X", "", "leaf-2"].join("\n");
    const blocks = parseBlocks(source);
    expect(blocks[0].headingPath).toEqual(["A", "B"]);
    expect(blocks[1].headingPath).toEqual(["X"]);
  });

  it("captures code, table, blockquote, list and thematic-break block types verbatim", () => {
    const source = [
      "# H",
      "",
      "```js",
      "const x = 1;",
      "```",
      "",
      "| a | b |",
      "| --- | --- |",
      "| 1 | 2 |",
      "",
      "> quoted text",
      "",
      "- item one",
      "- item two",
      "",
      "---",
      "",
      "final paragraph",
    ].join("\n");

    const blocks = parseBlocks(source);
    const types = blocks.map((b) => b.type);
    expect(types).toEqual(["code", "table", "blockquote", "list", "thematicBreak", "paragraph"]);
    expect(blocks[0].raw).toBe("```js\nconst x = 1;\n```");
    expect(blocks[1].raw).toContain("| 1 | 2 |");
    expect(blocks[2].raw).toBe("> quoted text");
  });

  it("reports 1-indexed start/end lines matching the source", () => {
    const source = ["# H", "", "line 3 content", "still line 4"].join("\n");
    const blocks = parseBlocks(source);
    expect(blocks[0].startLine).toBe(3);
    expect(blocks[0].endLine).toBe(4);
  });

  it("preserves the exact original substring, including inline formatting", () => {
    const source = "Some *italic*, **bold**, and `inline code` here.";
    const blocks = parseBlocks(source);
    expect(blocks[0].raw).toBe(source);
  });
});
