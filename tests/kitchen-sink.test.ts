import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { chunkMarkdown } from "../src/chunk.js";

const fixturePath = fileURLToPath(new URL("./fixtures/kitchen-sink.md", import.meta.url));
const source = readFileSync(fixturePath, "utf-8");

describe("chunkMarkdown on a full document", () => {
  it("never splits the bash install code fence", () => {
    const chunks = chunkMarkdown(source, { maxTokens: 120 });
    const installChunk = chunks.find((c) => c.text.includes("npm install chunkwise"));
    expect(installChunk).toBeDefined();
    expect(installChunk!.text).toContain("```bash");
    expect(installChunk!.text.match(/```/g)?.length).toBe(2);
  });

  it("never splits the js usage code fence", () => {
    const chunks = chunkMarkdown(source, { maxTokens: 120 });
    const usageChunk = chunks.find((c) => c.text.includes("chunk.headingPath, chunk.tokens"));
    expect(usageChunk).toBeDefined();
    expect(usageChunk!.text).toContain("```js");
    expect(usageChunk!.text).toContain("import { chunkMarkdown } from \"chunkwise\";");
  });

  it("keeps the benchmarks table together with its header row on every piece", () => {
    const chunks = chunkMarkdown(source, { maxTokens: 120 });
    const tableChunks = chunks.filter((c) => c.types.includes("table"));
    expect(tableChunks.length).toBeGreaterThan(0);
    for (const chunk of tableChunks) {
      expect(chunk.text).toContain("| Model | Tokens/sec | Notes |");
    }
    const joined = tableChunks.map((c) => c.text).join("\n");
    expect(joined).toContain("| A | 120 | baseline |");
    expect(joined).toContain("| B | 340 | quantized |");
    expect(joined).toContain("| C | 410 | quantized + batched |");
  });

  it("assigns the correct nested heading breadcrumb to the Requirements list", () => {
    const chunks = chunkMarkdown(source, { maxTokens: 500 });
    const reqChunk = chunks.find((c) => c.text.includes("Node 18+"));
    expect(reqChunk).toBeDefined();
    expect(reqChunk!.headingPath).toEqual(["Guide", "Setup", "Requirements"]);
  });

  it("returns Appendix to depth-2 breadcrumb after a depth-3 subsection", () => {
    const chunks = chunkMarkdown(source, { maxTokens: 500 });
    const appendixChunk = chunks.find((c) => c.text.includes("First item"));
    expect(appendixChunk).toBeDefined();
    expect(appendixChunk!.headingPath).toEqual(["Guide", "Appendix"]);
  });

  it("preserves the blockquote tip verbatim", () => {
    const chunks = chunkMarkdown(source, { maxTokens: 500 });
    const quoteChunk = chunks.find((c) => c.types.includes("blockquote"));
    expect(quoteChunk).toBeDefined();
    expect(quoteChunk!.text).toContain("> Tip: tune maxTokens to your embedding model's context window.");
  });

  it("loses no content across any chunking, for a range of token budgets", () => {
    const markers = [
      "Intro paragraph before any subsection",
      "npm install chunkwise",
      "Node 18+",
      "npm or pnpm",
      "import { chunkMarkdown } from \"chunkwise\";",
      "Tip: tune maxTokens",
      "| A | 120 | baseline |",
      "| B | 340 | quantized |",
      "| C | 410 | quantized + batched |",
      "Final section after a thematic break",
      "First item",
      "Second item",
      "Third item",
    ];

    for (const maxTokens of [30, 60, 120, 500, 5000]) {
      const chunks = chunkMarkdown(source, { maxTokens });
      const joined = chunks.map((c) => c.text).join("\n");
      for (const marker of markers) {
        expect(joined, `maxTokens=${maxTokens} missing "${marker}"`).toContain(marker);
      }
    }
  });

  it("every chunk carries a non-empty heading path or is top-level content, and valid line range", () => {
    const chunks = chunkMarkdown(source, { maxTokens: 200 });
    for (const chunk of chunks) {
      expect(chunk.startLine).toBeGreaterThan(0);
      expect(chunk.endLine).toBeGreaterThanOrEqual(chunk.startLine);
      expect(chunk.types.length).toBeGreaterThan(0);
    }
  });
});
