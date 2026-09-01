# chunkwise

Structure-aware Markdown chunker for RAG pipelines. Splits on headings, and
keeps code blocks and tables intact — instead of cutting at a fixed
character count.

```bash
npm install chunkwise
```

```js
import { chunkMarkdown } from "chunkwise";

const chunks = chunkMarkdown(markdownSource, {
  maxTokens: 500,     // default 500
  overlapTokens: 0,   // trailing tokens repeated across chunk boundaries
  includeHeadingPath: true, // prefix each chunk with its heading breadcrumb
});

for (const chunk of chunks) {
  chunk.text;        // chunk body (with heading breadcrumb prefix, if enabled)
  chunk.tokens;       // token count for chunk.text
  chunk.headingPath;  // e.g. ["Setup", "Install"]
  chunk.startLine;    // source line range, for citation/highlighting
  chunk.endLine;
  chunk.types;        // mdast block types included: paragraph, code, table, ...
}
```

## Why

Most text splitters cut by fixed character windows, which can slice a code
block or a table row in half. chunkwise parses the document into a real
Markdown AST first, then packs whole blocks (paragraphs, code fences,
tables, lists) into chunks up to a token budget — an atomic block is only
split as a last resort, when it alone exceeds the budget.

Every chunk carries its heading breadcrumb and exact source line range, so
you can cite back to the original document (highlight the exact lines a
chunk came from, not just an approximate offset).

### What other splitters don't do

Checked against each library's actual source, not just its pitch:

| Library | Approach | Gap vs. chunkwise |
| --- | --- | --- |
| `@langchain/textsplitters` (`RecursiveCharacterTextSplitter` / `MarkdownTextSplitter`) | Recursive separator matching (`\n\n`, `\n`, `" "`, ...), falls back to character count | Separator-based, not AST-based — can still cut a table row or a code fence mid-block in edge cases. No heading breadcrumb or source line range on the output. |
| LlamaIndex.ts (`MarkdownNodeParser`) | Line-by-line regex scan; one node per header section, skipping `#` matches inside fenced code | No token/size budget at all — an entire section becomes a single node no matter how large, so it doesn't solve "make this fit an embedding model's context window." No line-range metadata; not a real AST parse. |
| Mastra (`@mastra/rag`) | Two separate pieces: `MarkdownHeaderTransformer` (regex-based, aware of headers/tables/code fences) and `MarkdownTransformer` (a `RecursiveCharacterTransformer` for size-bounded splitting) | The two aren't combined in one pass — getting both "never split code/tables" and "stay under N tokens" means chaining transformers yourself. No line-range metadata; regex-based, not AST. |
| `semantic-chunking` | Sentence embeddings (local ONNX model) + cosine-similarity cut points | Needs an embedding model on disk and an ONNX runtime — heavy, not practical in a browser bundle, and topic-similarity cuts don't understand "this is a code fence, don't touch it." |
| Chonkie / `chonkiejs` | Multi-strategy toolkit (semantic, code-AST, token, recursive splitters) | Broad and capable, but that breadth is the trade-off — bigger surface and bundle than a document needs when all you want is Markdown-aware chunks with citation metadata. |
| `llm-splitter` | Generic token-budget splitter with overlap; tracks exact start/end character offsets so you don't have to store chunk text | Not Markdown-aware at all — no heading, code, or table concept, so any splitter function you give it can still cut mid-table or mid-code-fence. |

chunkwise's bet is narrow on purpose: Markdown only, real AST (via
`remark`/`unified`), atomic code/table blocks *under* a token budget in one
pass, heading breadcrumb + exact line numbers on every chunk, zero heavy
runtime deps (no ONNX, no model download) — so it runs the same in Node and
in the browser.

## Performance

chunkwise parses a real Markdown AST (`remark`/`unified`), which costs more
per call than the regex-based scanning the libraries above use — measured
against `@langchain/textsplitters`, `llm-splitter`, and `@chonkiejs/core` on
the same documents, chunkwise is roughly 100-300x slower (single-digit
milliseconds vs. sub-millisecond, on a ~21KB document). Profiling traced
this entirely to the AST parse itself (`remark-gfm`'s table support roughly
doubles it); the token counter and the packing algorithm are not the
bottleneck. That gap is the real cost of the guarantee this library sells:
in the same benchmark, two of those faster libraries each broke a small
code fence that was well under the token budget — something that can't
happen here, by construction, since blocks are real AST nodes, not regex
guesses. In absolute terms this is noise next to a single embeddings API
call; it matters mainly for very large batch ingestion. See the sibling
`chunkwise-test` project for the full methodology and numbers.

## Custom tokenizer

By default, chunkwise counts tokens with a cl100k-style tokenizer
(`gpt-tokenizer`, pure JS, works in Node and the browser). Pass your own:

```js
chunkMarkdown(source, { countTokens: (text) => myTokenizer.encode(text).length });
```

## License

MIT
