import { encode } from "gpt-tokenizer";
import type { TokenCounter } from "./types.js";

/**
 * Default token counter (cl100k-style, via gpt-tokenizer).
 * Pure JS, no native deps — works in Node and the browser.
 */
export const defaultCountTokens: TokenCounter = (text: string): number =>
  encode(text).length;
