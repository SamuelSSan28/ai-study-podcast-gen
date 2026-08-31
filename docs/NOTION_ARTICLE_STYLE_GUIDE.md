# Notion Article Style Guide

This document defines how study articles should be presented visually in Notion.

The goal is to keep all articles consistent, easy to scan, and pleasant for technical reading.

For the compact version injected into generation prompts, see `NOTION_ARTICLE_RULES` in `src/persistence/notion-format.contract.ts`.

---

## 1. Page title

The main title should exist only as the **Notion page title**.

Do not repeat the title as an `H1` inside the body.

### Correct

```text
Page title:
Idempotency in Distributed Systems

Content:
Intro...
## Why this matters
...
```

### Avoid

```text
Page title:
Idempotency in Distributed Systems

# Idempotency in Distributed Systems
```

---

## 2. Introduction

The introduction should be at most **2 or 3 short paragraphs**.

Avoid lists immediately after the title.

Use **bold** only for terms that truly matter.

### Example

In distributed systems, the same operation can reach the server more than once.

This becomes especially dangerous for operations such as **payments**, **order creation**, or **event publishing**.

Idempotency lets those repetitions be handled without executing the same action twice.

---

## 3. Heading hierarchy

Use only:

- `H2` for major sections;
- `H3` for internal subsections.

Avoid `H1` inside the article.

### Example

```text
## Why idempotency matters

### Network retries

### Duplicate messages

## Implementation strategies

### Idempotency keys

### Database constraints
```

Do not create too many headings.

A section should have enough content to justify a heading.

---

## 4. Bold usage

Use **bold** for:

- important concepts;
- pattern names;
- keywords;
- important decisions;
- essential parts of a definition.

### Example

An **idempotency key** identifies a logical operation and makes repeated requests recognizable.

Avoid entire sentences in bold.

### Bad

**An idempotency key identifies a logical operation and makes repeated requests recognizable.**

---

## 5. Italic usage

Use *italic* sparingly for:

- observations;
- small caveats;
- auxiliary terms;
- editorial comments.

Do not use italic as the primary emphasis style.

---

## 6. Paragraphs

Prefer paragraphs of **2–4 sentences**.

Avoid large text blocks.

Start a new paragraph whenever the idea changes significantly.

### Bad

A single paragraph with ten or fifteen lines mixing definition, example, exception, and conclusion.

### Better

Separate:

1. definition;
2. problem;
3. example;
4. consequence.

---

## 7. Lists

Use bullet lists when items are independent.

### Example

An idempotency implementation usually needs to consider:

- operation identification;
- key persistence;
- result storage;
- expiration;
- concurrency.

Use numbered lists only when there is **order or sequence**.

### Example

1. The client generates a key.
2. It sends the request.
3. The server checks the key.
4. The operation runs.
5. The result is stored.

Do not turn the entire article into lists.

---

## 8. Code blocks

Any code longer than one line should use a **native Notion code block**.

Always specify a **Notion-supported** language when possible.

Preferred values: `typescript`, `javascript`, `python`, `bash`, `shell`, `json`, `sql`, `html`, `css`, `yaml`, `markdown`, `plain text`, `mermaid`.

Do **not** use labels Notion rejects (publish will fail or be remapped): `jsx`, `tsx`, `react`, `vue`, `svelte`, `nodejs`, etc. Use `javascript` or `typescript` for React/JSX examples.

### Example

```typescript
const existingRequest = await repository.findByKey(
  idempotencyKey,
);

if (existingRequest) {
  return existingRequest.response;
}
```

Never put multiline code in regular paragraphs.

For small code names, use `inline code`.

### Example

Use the `Idempotency-Key` header to identify the operation.

---

## 9. Code block + explanation

Never add code without explaining why it exists.

Prefer this pattern:

```text
Context

[code block]

Explanation
```

### Example

A simple implementation can check the key before processing the operation:

```typescript
if (await exists(key)) {
  return cachedResponse;
}
```

Here, the application stops the flow before the operation runs again.

---

## 10. Quotes

Use `quote` to highlight:

- an important principle;
- a mental rule;
- a short definition;
- a takeaway.

### Example

> Idempotency does not prevent retries. It makes retries safe.

Do not use quotes as decoration only.

---

## 11. Callouts

Use callouts only for information that deserves special attention.

Recommended types:

### 💡 Insight

For mental models or important observations.

### ⚠️ Warning

For pitfalls and dangerous behavior.

### ✅ Rule of thumb

For practical rules.

### 🧠 Remember

For something important to review.

Avoid more than **2–4 callouts per article**.

---

## 12. Examples

Always separate examples from the main text.

Prefer:

### Example

Short explanation.

```typescript
...
```

Result or interpretation.

For conceptual examples without code, use a quote or a separate block.

---

## 13. Diagrams

For simple flows, use a textual code block or Mermaid when the pipeline supports it.

### Example

```text
Client
  ↓
API
  ↓
Idempotency Check
  ├── Exists → return previous response
  └── New → execute operation
```

Avoid diagrams for things that can be explained in two sentences.

---

## 14. Tables

Use tables for comparison.

### Example

| Strategy   | Benefit            | Trade-off                 |
| ---------- | ------------------ | ------------------------- |
| Redis      | Fast               | Additional infrastructure |
| PostgreSQL | Strong consistency | More DB load              |
| In-memory  | Simple             | Not distributed           |

Do not use a table just to organize ordinary prose.

---

## 15. Dividers

Use `divider` only between major article blocks.

Example:

```text
Introduction

---

## Core concepts
...

---

## Practice
```

Avoid dividers between every subsection.

---

## 16. Technical term emphasis

On the first appearance of an important concept:

An **idempotency key** is an identifier associated with a logical operation.

After that, use normal text or `inline code` when referring to the technical name.

---

## 17. Reflection questions

Standalone questions should stand out.

### Example

> What happens if the request succeeds but the response never reaches the client?

After the question, explain the scenario.

This helps turn reading into active study.

---

## 18. Visual spacing

The article should not feel like a wall of text.

Roughly every **3–5 content blocks**, there should be some visual change when it makes sense:

- heading;
- list;
- code block;
- quote;
- callout;
- table;
- diagram.

Do not insert visual elements artificially just to satisfy this rule.

---

## 19. Recommended technical section pattern

A good section usually follows:

```text
## Section title

1–2 paragraphs introducing the concept.

> Important insight or question.

Additional explanation.

```language
code example
```

Code explanation.

* consequence 1;
* consequence 2;
* consequence 3.
```

Not every section needs all of these elements.

---

## 20. What to avoid

Avoid:

- H1 inside the article;
- headings every two paragraphs;
- very long paragraphs;
- excessive bold;
- emojis in every heading;
- code without a language;
- code languages Notion does not accept (`jsx`, `tsx`, `react`, …);
- code without explanation;
- huge lists;
- too many callouts;
- tables for narrative content;
- repeating the same information in prose, list, and callout;
- raw Markdown sent to Notion.

---

## 21. Expected visual density

For an article of roughly 20–30 minutes:

- 5–8 H2 sections;
- H3 only when needed;
- 2–5 code blocks in technical articles;
- 1–3 quotes;
- 1–3 callouts;
- short lists;
- at most 1–2 tables;
- short paragraphs;
- roughly 1 visual or structural element every 3–5 blocks.

These numbers are guidelines, not hard requirements.

---

## 22. Final rule

Priority should be:

**readability → comprehension → consistency → aesthetics**

Never add formatting just because Notion supports that block.

Every visual element should help the reader understand or navigate the content.

---

## Code contract

The AI model should emit semantic blocks (`heading`, `paragraph`, `code`, `quote`, `callout`, `list`, etc.).

`NotionBlockRenderer` in `src/persistence/notion-block.renderer.ts` maps those blocks to native Notion API types.

Semantic types are defined as `ArticleContentBlock` in `src/persistence/notion-format.contract.ts`.

Code `language` values must match Notion’s code-block enum. The renderer normalizes common aliases (`jsx` → `javascript`, `tsx` → `typescript`) and falls back to `plain text` for unknown labels so publish never fails on language validation.

Tables in semantic content are currently rendered as a heading row plus bullets (not Notion native `table` blocks) — that is intentional for API simplicity, not a validation gap.
