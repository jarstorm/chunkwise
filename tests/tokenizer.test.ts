import { describe, expect, it } from "vitest";
import { defaultCountTokens } from "../src/tokenizer.js";

describe("defaultCountTokens", () => {
  it("returns 0 for an empty string", () => {
    expect(defaultCountTokens("")).toBe(0);
  });

  it("returns a positive count for non-empty text", () => {
    expect(defaultCountTokens("hello world")).toBeGreaterThan(0);
  });

  it("counts more tokens for longer text", () => {
    const short = defaultCountTokens("hello");
    const long = defaultCountTokens("hello ".repeat(50));
    expect(long).toBeGreaterThan(short);
  });

  it("is deterministic for the same input", () => {
    const text = "The quick brown fox jumps over the lazy dog.";
    expect(defaultCountTokens(text)).toBe(defaultCountTokens(text));
  });
});
