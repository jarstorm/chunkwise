import { describe, expect, it } from "vitest";
import { chunkMarkdown } from "../src/chunk.js";

describe("chunkMarkdown", () => {
  it("keeps a fenced code block intact inside one chunk", () => {
    const source = [
      "# Setup",
      "",
      "Install the package first.",
      "",
      "```js",
      "import { chunkMarkdown } from 'chunkwise';",
      "const chunks = chunkMarkdown(text);",
      "```",
      "",
      "Done.",
    ].join("\n");

    const chunks = chunkMarkdown(source, { maxTokens: 200 });
    const withCode = chunks.find((c) => c.types.includes("code"));
    expect(withCode).toBeDefined();
    expect(withCode!.text).toContain("```js");
    expect(withCode!.text).toContain("chunkMarkdown(text);");
    expect(withCode!.text).toContain("```\n");
  });

  it("keeps a GFM table intact and attaches the heading breadcrumb", () => {
    const source = [
      "# Report",
      "## Results",
      "",
      "| Name | Score |",
      "| --- | --- |",
      "| A | 1 |",
      "| B | 2 |",
    ].join("\n");

    const chunks = chunkMarkdown(source, { maxTokens: 200 });
    expect(chunks).toHaveLength(1);
    expect(chunks[0].headingPath).toEqual(["Report", "Results"]);
    expect(chunks[0].text.startsWith("Report > Results")).toBe(true);
    expect(chunks[0].text).toContain("| A | 1 |");
    expect(chunks[0].text).toContain("| B | 2 |");
  });

  it("starts a new chunk when the heading breadcrumb changes", () => {
    const source = [
      "# One",
      "",
      "Content for section one.",
      "",
      "# Two",
      "",
      "Content for section two.",
    ].join("\n");

    const chunks = chunkMarkdown(source, { maxTokens: 500, includeHeadingPath: false });
    expect(chunks).toHaveLength(2);
    expect(chunks[0].headingPath).toEqual(["One"]);
    expect(chunks[1].headingPath).toEqual(["Two"]);
  });

  it("packs multiple small paragraphs under the same heading into one chunk", () => {
    const source = [
      "# Notes",
      "",
      "First short paragraph.",
      "",
      "Second short paragraph.",
      "",
      "Third short paragraph.",
    ].join("\n");

    const chunks = chunkMarkdown(source, { maxTokens: 500 });
    expect(chunks).toHaveLength(1);
    expect(chunks[0].types).toEqual(["paragraph"]);
  });

  it("hard-splits a code block that alone exceeds maxTokens, never dropping content", () => {
    const bigBody = Array.from({ length: 40 }, (_, i) => `const line${i} = ${i};`).join("\n");
    const source = ["# Big", "", "```js", bigBody, "```"].join("\n");

    const chunks = chunkMarkdown(source, { maxTokens: 30 });
    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(chunk.text).toContain("```");
    }
    const joined = chunks.map((c) => c.text).join("\n");
    for (let i = 0; i < 40; i++) {
      expect(joined).toContain(`const line${i} = ${i};`);
    }
  });

  it("applies token overlap between consecutive chunks", () => {
    const source = [
      "# Section",
      "",
      "First sentence here now.",
      "",
      "Second sentence follows next.",
      "",
      "Third sentence wraps up.",
    ].join("\n");

    const noOverlap = chunkMarkdown(source, { maxTokens: 5, includeHeadingPath: false });
    const withOverlap = chunkMarkdown(source, { maxTokens: 5, overlapTokens: 2, includeHeadingPath: false });

    expect(noOverlap.length).toBeGreaterThan(1);
    expect(withOverlap.length).toBeGreaterThanOrEqual(noOverlap.length);
    const lastWordOfFirst = withOverlap[0].text.trim().split(/\s+/).slice(-1)[0];
    expect(withOverlap[1].text.startsWith(lastWordOfFirst)).toBe(true);
    expect(withOverlap[1].tokens).toBeGreaterThan(noOverlap[1].tokens);
  });

  it("reports exact start/end line numbers", () => {
    const source = ["# Title", "", "Paragraph one.", "", "Paragraph two."].join("\n");
    const chunks = chunkMarkdown(source, { maxTokens: 500 });
    expect(chunks[0].startLine).toBe(3);
    expect(chunks[0].endLine).toBe(5);
  });

  it("returns no chunks for an empty document", () => {
    expect(chunkMarkdown("")).toEqual([]);
  });

  it("returns no chunks for a document with only headings", () => {
    expect(chunkMarkdown("# One\n## Two\n### Three")).toEqual([]);
  });

  it("never produces an empty chunk between two consecutive headings with no body", () => {
    const source = ["# One", "## Two", "", "Body under Two."].join("\n");
    const chunks = chunkMarkdown(source, { maxTokens: 500 });
    expect(chunks).toHaveLength(1);
    expect(chunks[0].text.length).toBeGreaterThan(0);
  });

  it("prefixes with the heading breadcrumb by default", () => {
    const source = ["# Title", "", "Body."].join("\n");
    const chunks = chunkMarkdown(source, { maxTokens: 500 });
    expect(chunks[0].text.startsWith("Title\n\n")).toBe(true);
  });

  it("omits the heading breadcrumb prefix when includeHeadingPath is false", () => {
    const source = ["# Title", "", "Body."].join("\n");
    const chunks = chunkMarkdown(source, { maxTokens: 500, includeHeadingPath: false });
    expect(chunks[0].text).toBe("Body.");
  });

  it("uses a custom token counter when provided", () => {
    const source = ["# Title", "", "1234567890"].join("\n");
    const countTokens = (text: string) => text.length;
    const chunks = chunkMarkdown(source, { maxTokens: 500, countTokens, includeHeadingPath: false });
    expect(chunks[0].tokens).toBe(countTokens("1234567890"));
  });

  it("puts an entire document with no heading into a single chunk when it fits", () => {
    const source = ["Paragraph one.", "", "Paragraph two.", "", "Paragraph three."].join("\n");
    const chunks = chunkMarkdown(source, { maxTokens: 500 });
    expect(chunks).toHaveLength(1);
    expect(chunks[0].headingPath).toEqual([]);
  });

  it("does not merge blocks from different headings even when both fit the token budget", () => {
    const source = ["# A", "", "short", "", "# B", "", "short too"].join("\n");
    const chunks = chunkMarkdown(source, { maxTokens: 500, includeHeadingPath: false });
    expect(chunks).toHaveLength(2);
    expect(chunks[0].text).toBe("short");
    expect(chunks[1].text).toBe("short too");
  });

  it("splits an oversized table that alone exceeds maxTokens, never dropping rows", () => {
    const header = "| a | b |";
    const sep = "| --- | --- |";
    const rows = Array.from({ length: 15 }, (_, i) => `| r${i} | v${i} |`);
    const source = ["# T", "", header, sep, ...rows].join("\n");

    const chunks = chunkMarkdown(source, { maxTokens: 25 });
    expect(chunks.length).toBeGreaterThan(1);
    const joined = chunks.map((c) => c.text).join("\n");
    for (const row of rows) {
      expect(joined).toContain(row);
    }
  });

  it("keeps every chunk's own text within maxTokens, except unavoidable oversized single blocks", () => {
    const source = [
      "# Doc",
      "",
      "Short paragraph one.",
      "",
      "Short paragraph two.",
      "",
      "Short paragraph three.",
      "",
      "Short paragraph four.",
    ].join("\n");
    const maxTokens = 12;
    const chunks = chunkMarkdown(source, { maxTokens, includeHeadingPath: false });
    for (const chunk of chunks) {
      expect(chunk.tokens).toBeLessThanOrEqual(maxTokens);
    }
  });
});
