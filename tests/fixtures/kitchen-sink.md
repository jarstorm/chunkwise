# Guide

Intro paragraph before any subsection, at the top level.

## Setup

Install steps go here, short paragraph.

```bash
npm install chunkwise
```

### Requirements

- Node 18+
- npm or pnpm

## Usage

Basic call, then a bigger example.

```js
import { chunkMarkdown } from "chunkwise";

const chunks = chunkMarkdown(source, {
  maxTokens: 500,
  overlapTokens: 0,
});

for (const chunk of chunks) {
  console.log(chunk.headingPath, chunk.tokens);
}
```

> Tip: tune maxTokens to your embedding model's context window.

## Benchmarks

| Model | Tokens/sec | Notes |
| --- | --- | --- |
| A | 120 | baseline |
| B | 340 | quantized |
| C | 410 | quantized + batched |

---

## Appendix

Final section after a thematic break, back at depth 2 after a depth 3 subsection earlier.

1. First item
2. Second item
3. Third item
