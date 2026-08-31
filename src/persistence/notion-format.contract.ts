/** Full human spec: docs/NOTION_ARTICLE_STYLE_GUIDE.md */
export const NOTION_FORMAT_VERSION = 'notion-format.v2';

export const NOTION_PLAN_OVERVIEW_RULES = `Notion publishing rules for the plan overview field:
- Write overview as flowing prose in short paragraphs (2–4 sentences each).
- Incorporate the study goal naturally; do not repeat the raw goal as a separate bullet list.
- Do not include a numbered or bulleted topic list in overview — topics live in the Topics database.
- Use natural English suitable for reading in Notion.`;

export const NOTION_ARTICLE_RULES = `Notion article visual and editorial rules (full spec: docs/NOTION_ARTICLE_STYLE_GUIDE.md):
- Never repeat the page title as H1.
- Use H2 for major sections and H3 only for subsections.
- Keep paragraphs short: normally 2-4 sentences.
- Use bold only for key concepts and important terms.
- Use inline_code for identifiers, headers, APIs and small code references.
- Use code_block for multiline code and always provide a Notion-supported language.
- Preferred languages: typescript, javascript, python, bash, shell, json, sql, html, css, yaml, markdown, plain text, mermaid.
- Never use jsx, tsx, react, vue, or other non-Notion labels — use javascript or typescript instead.
- Every code block must have explanatory text before or after it.
- Use bullet lists for unordered information and numbered lists only for sequences.
- Use quotes for important principles or reflection questions.
- Use callouts sparingly for insights, warnings and rules of thumb.
- Prefer tables only for comparisons.
- Avoid walls of text and excessive visual elements.
- Introduce a visual/structural break when several consecutive paragraphs make the section hard to scan.
- Emit semantic content blocks (heading, paragraph, code, quote, callout, list, divider, table); do not embed raw Markdown in field values.
- Every paragraph block must include italic (true only for intentionally de-emphasized or voice-over lines; otherwise false).`;

export type ArticleCalloutVariant = 'insight' | 'warning' | 'rule' | 'remember';

/** Semantic blocks the model emits; NotionBlockRenderer maps these to Notion API blocks. */
export type ArticleContentBlock =
  | { type: 'paragraph'; text: string; italic: boolean }
  | { type: 'heading'; level: 2 | 3; text: string }
  | { type: 'bullet_list'; items: string[] }
  | { type: 'numbered_list'; items: string[] }
  | { type: 'quote'; text: string }
  | { type: 'callout'; variant: ArticleCalloutVariant; text: string }
  | { type: 'code'; language: string; code: string }
  | { type: 'divider' }
  | { type: 'table'; headers: string[]; rows: string[][] };

export const NOTION_SCRIPT_RULES = `Notion publishing rules for podcast script turns:
- Keep each turn text spoken and reasonably concise (avoid monologues).
- Use stable sectionId values (kebab-case) that group related turns.
- Set role on each turn (HOOK, QUESTION, EXPLAIN, EXAMPLE, CHALLENGE, ANSWER, CORRECTION, RECAP, TRANSITION).
- Set delivery.style (normal, reflective, conversational, energetic, question) — the audio renderer maps style to pauses and chunking.
- Put optional delivery hints in the delivery object (style, tone, emphasis). Do not put pause timings in the script.
- Do not use Markdown in turn text.`;

export const NOTION_POLISHER_PUBLISH_RULES = `Preserve structured turns (ids, sequence, sectionId, speaker) so the script can be rendered as Notion quote blocks with speaker labels. Do not merge turns into unstructured prose.`;

export const NOTION_BLOCK_PATTERNS = {
  planOverview: ['heading_2:Overview', 'paragraph[]', 'divider', 'paragraph:dashboard'],
  articleSection: [
    'heading_2|heading_3',
    'paragraph',
    'quote',
    'callout',
    'code',
    'bulleted_list_item[]|numbered_list_item[]',
    'table',
    'divider',
  ],
  scriptSection: ['heading_2:{sectionId}', 'quote:boldSpeaker+text', 'paragraph italic:delivery'],
} as const;
