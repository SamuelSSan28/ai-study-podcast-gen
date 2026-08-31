import { enrichArticleOutline, seedArticleOutline } from '../domain/article-outline';
import {
  DeliveryDirection,
  PodcastSpeaker,
  StudyContent,
  StudyPlanTopic,
  StudySession,
  TopicResearch,
} from '../domain/models';
import { ArticleContentBlock, ArticleCalloutVariant } from './notion-format.contract';
import { NotionBlock, NotionRichText } from './notion-mappers';

const CHUNK_SIZE = 1900;
const NOTION_CODE_LANGUAGES = new Set([
  'abap',
  'abc',
  'agda',
  'arduino',
  'ascii art',
  'assembly',
  'bash',
  'basic',
  'bnf',
  'c',
  'c#',
  'c++',
  'clojure',
  'coffeescript',
  'coq',
  'css',
  'dart',
  'dhall',
  'diff',
  'docker',
  'ebnf',
  'elixir',
  'elm',
  'erlang',
  'f#',
  'flow',
  'fortran',
  'gherkin',
  'glsl',
  'go',
  'graphql',
  'groovy',
  'haskell',
  'hcl',
  'html',
  'idris',
  'java',
  'javascript',
  'json',
  'julia',
  'kotlin',
  'latex',
  'less',
  'lisp',
  'livescript',
  'llvm ir',
  'lua',
  'makefile',
  'markdown',
  'markup',
  'matlab',
  'mathematica',
  'mermaid',
  'nix',
  'notion formula',
  'objective-c',
  'ocaml',
  'pascal',
  'perl',
  'php',
  'plain text',
  'powershell',
  'prolog',
  'protobuf',
  'purescript',
  'python',
  'r',
  'racket',
  'reason',
  'ruby',
  'rust',
  'sass',
  'scala',
  'scheme',
  'scss',
  'shell',
  'smalltalk',
  'solidity',
  'sql',
  'swift',
  'toml',
  'typescript',
  'vb.net',
  'verilog',
  'vhdl',
  'visual basic',
  'webassembly',
  'xml',
  'yaml',
  'java/c/c++/c#',
]);

/** Common LLM / Markdown labels that are not Notion API language enums. */
const NOTION_CODE_LANGUAGE_ALIASES: Record<string, string> = {
  js: 'javascript',
  jsx: 'javascript',
  mjs: 'javascript',
  cjs: 'javascript',
  node: 'javascript',
  nodejs: 'javascript',
  react: 'javascript',
  vue: 'javascript',
  svelte: 'javascript',
  ts: 'typescript',
  tsx: 'typescript',
  typescriptreact: 'typescript',
  javascriptreact: 'javascript',
  sh: 'shell',
  zsh: 'shell',
  fish: 'shell',
  shellscript: 'shell',
  console: 'shell',
  terminal: 'shell',
  bash: 'bash',
  text: 'plain text',
  txt: 'plain text',
  plaintext: 'plain text',
  'plain-text': 'plain text',
  none: 'plain text',
  output: 'plain text',
  logs: 'plain text',
  log: 'plain text',
  md: 'markdown',
  yml: 'yaml',
  dockerfile: 'docker',
  terraform: 'hcl',
  tf: 'hcl',
  csharp: 'c#',
  cs: 'c#',
  cpp: 'c++',
  'c++': 'c++',
  cxx: 'c++',
  golang: 'go',
  py: 'python',
  rb: 'ruby',
  rs: 'rust',
  kt: 'kotlin',
  objc: 'objective-c',
  objectivec: 'objective-c',
  ps1: 'powershell',
  pwsh: 'powershell',
  postgresql: 'sql',
  postgres: 'sql',
  mysql: 'sql',
  sqlite: 'sql',
  plsql: 'sql',
  k8s: 'yaml',
  kubernetes: 'yaml',
  jsonc: 'json',
  json5: 'json',
};

export interface ArticleRenderInput {
  topic: StudyPlanTopic;
  content?: StudyContent;
  research?: TopicResearch;
  session?: StudySession;
  dashboardUrl: string;
  scriptPageUrl?: string;
}

export interface NotionBlockRenderer {
  renderPlanOverview(overview: string, dashboardUrl: string): NotionBlock[];
  renderArticle(input: ArticleRenderInput): NotionBlock[];
  renderContentBlocks(blocks: ArticleContentBlock[]): NotionBlock[];
  renderScript(session: StudySession): NotionBlock[];
}

function richText(
  content: string,
  options?: { link?: string; bold?: boolean; italic?: boolean },
): NotionRichText {
  const slice = content.slice(0, CHUNK_SIZE);
  const annotations =
    options?.bold || options?.italic
      ? {
          bold: options.bold ?? false,
          italic: options.italic ?? false,
          strikethrough: false,
          underline: false,
          code: false,
          color: 'default' as const,
        }
      : undefined;
  return {
    type: 'text',
    text: {
      content: slice,
      ...(options?.link ? { link: { url: options.link } } : {}),
    },
    ...(annotations ? { annotations } : {}),
  };
}

function paragraph(content: string, options?: { italic?: boolean }): NotionBlock {
  return {
    object: 'block',
    type: 'paragraph',
    paragraph: {
      rich_text: content.trim() ? [richText(content, { italic: options?.italic })] : [],
    },
  };
}

function heading2(content: string): NotionBlock {
  return {
    object: 'block',
    type: 'heading_2',
    heading_2: { rich_text: [richText(content)] },
  };
}

function bullet(content: string, link?: string): NotionBlock {
  return {
    object: 'block',
    type: 'bulleted_list_item',
    bulleted_list_item: { rich_text: [richText(content, { link })] },
  };
}

function quote(speaker: string, text: string): NotionBlock {
  return {
    object: 'block',
    type: 'quote',
    quote: {
      rich_text: [
        richText(`${speaker}: `, { bold: true }),
        ...chunkRichText(text),
      ],
    },
  };
}

function heading3(content: string): NotionBlock {
  return {
    object: 'block',
    type: 'heading_3',
    heading_3: { rich_text: [richText(content)] },
  };
}

function numbered(content: string): NotionBlock {
  return {
    object: 'block',
    type: 'numbered_list_item',
    numbered_list_item: { rich_text: [richText(content)] },
  };
}

function codeBlock(code: string, language: string): NotionBlock {
  const normalizedLanguage = normalizeNotionCodeLanguage(language);
  return {
    object: 'block',
    type: 'code',
    code: {
      rich_text: chunkRichText(code),
      language: normalizedLanguage,
    },
  };
}

function normalizeNotionCodeLanguage(language: string): string {
  const raw = language
    ?.trim()
    .toLowerCase()
    .replace(/^language\s*[:=]\s*/i, '')
    .replace(/^```+/, '')
    .replace(/```+$/, '');
  if (!raw) return 'plain text';
  const mapped = NOTION_CODE_LANGUAGE_ALIASES[raw] ?? raw;
  return NOTION_CODE_LANGUAGES.has(mapped) ? mapped : 'plain text';
}

const CALLOUT_EMOJI: Record<ArticleCalloutVariant, string> = {
  insight: '💡',
  warning: '⚠️',
  rule: '✅',
  remember: '🧠',
};

function callout(variant: ArticleCalloutVariant, text: string): NotionBlock {
  return {
    object: 'block',
    type: 'callout',
    callout: {
      rich_text: chunkRichText(text),
      icon: { type: 'emoji', emoji: CALLOUT_EMOJI[variant] },
    },
  };
}

function textQuote(text: string): NotionBlock {
  return {
    object: 'block',
    type: 'quote',
    quote: { rich_text: chunkRichText(text) },
  };
}

function divider(): NotionBlock {
  return { object: 'block', type: 'divider', divider: {} };
}

function renderSemanticBlock(block: ArticleContentBlock): NotionBlock[] {
  switch (block.type) {
    case 'paragraph':
      return [paragraph(block.text, { italic: block.italic === true })];
    case 'heading':
      return [block.level === 3 ? heading3(block.text) : heading2(block.text)];
    case 'bullet_list':
      return block.items.map((item) => bullet(item));
    case 'numbered_list':
      return block.items.map((item) => numbered(item));
    case 'quote':
      return [textQuote(block.text)];
    case 'callout':
      return [callout(block.variant, block.text)];
    case 'code':
      return [codeBlock(block.code, block.language)];
    case 'divider':
      return [divider()];
    case 'table': {
      const rows = [block.headers, ...block.rows];
      return rows.map((cells, rowIndex) => {
        const rowText = cells.join(' | ');
        return rowIndex === 0 ? heading3(rowText) : bullet(rowText);
      });
    }
    default:
      return [];
  }
}

function pushParagraphs(blocks: NotionBlock[], value: string): void {
  for (const chunk of value.match(new RegExp(`[\\s\\S]{1,${CHUNK_SIZE}}`, 'g')) ?? []) {
    blocks.push(paragraph(chunk));
  }
}

function chunkRichText(value: string): NotionRichText[] {
  const chunks = value.match(new RegExp(`[\\s\\S]{1,${CHUNK_SIZE}}`, 'g')) ?? [];
  if (!chunks.length) return [richText('')];
  return chunks.map((chunk) => richText(chunk));
}

function speakerLabel(speaker: PodcastSpeaker): string {
  if (speaker === 'INSTRUCTOR') return 'Instructor';
  if (speaker === 'CO_HOST') return 'Q&A';
  if (speaker === 'ENGINEER_A') return 'Engineer A';
  if (speaker === 'ENGINEER_B') return 'Engineer B';
  return speaker[0] + speaker.slice(1).toLowerCase();
}

function humanizeSectionId(sectionId: string): string {
  return sectionId.replace(/-/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

function deliveryHint(delivery?: DeliveryDirection | null): string | undefined {
  if (!delivery) return undefined;
  const parts = [
    delivery.tone ? `tone: ${delivery.tone}` : null,
    delivery.pace ? `pace: ${delivery.pace}` : null,
    delivery.emphasis?.length ? `emphasis: ${delivery.emphasis.join(', ')}` : null,
  ].filter(Boolean);
  return parts.length ? parts.join(' · ') : undefined;
}

export class DefaultNotionBlockRenderer implements NotionBlockRenderer {
  renderContentBlocks(blocks: ArticleContentBlock[]): NotionBlock[] {
    return blocks.flatMap((block) => renderSemanticBlock(block));
  }

  renderPlanOverview(overview: string, dashboardUrl: string): NotionBlock[] {
    const blocks: NotionBlock[] = [heading2('Overview')];
    pushParagraphs(blocks, overview || 'Overview pending…');
    blocks.push(divider(), paragraph(`Open in dashboard → ${dashboardUrl}`));
    return blocks;
  }

  renderArticle(input: ArticleRenderInput): NotionBlock[] {
    const { topic, content, session, dashboardUrl, scriptPageUrl } = input;
    const outline = content
      ? enrichArticleOutline(topic, content, input.research)
      : (topic.articleOutline ?? seedArticleOutline(topic));
    const blocks: NotionBlock[] = [];

    pushParagraphs(blocks, topic.summary || topic.description || 'Topic summary pending…');

    if (scriptPageUrl) {
      blocks.push(heading2('Podcast script'));
      blocks.push(bullet('Open script page', scriptPageUrl));
    }

    if (content) {
      for (const section of content.sections) {
        blocks.push(heading2(section.title));
        blocks.push(...this.renderContentBlocks(section.blocks));
      }
      if (content.reviewQuestions?.length) {
        blocks.push(heading2('Review questions'));
        for (const question of content.reviewQuestions) blocks.push(bullet(question));
      }
    } else {
      blocks.push(heading2('Content'));
      blocks.push(
        paragraph(
          'Article in progress — sections will be filled after research and technical content generation.',
        ),
      );
    }

    if (session?.audioUrl) {
      blocks.push(divider(), heading2('Audio'));
      blocks.push(paragraph(`Listen: ${session.audioUrl}`));
    }

    blocks.push(divider(), paragraph(`Open in dashboard → ${dashboardUrl}`));
    return blocks;
  }

  renderScript(session: StudySession): NotionBlock[] {
    const blocks: NotionBlock[] = [heading2('Overview')];
    pushParagraphs(blocks, session.summary || session.title);

    if (!session.script?.turns.length) {
      blocks.push(paragraph('Script pending generation…'));
      return blocks;
    }

    const bySection = new Map<string, typeof session.script.turns>();
    for (const turn of session.script.turns) {
      const list = bySection.get(turn.sectionId) ?? [];
      list.push(turn);
      bySection.set(turn.sectionId, list);
    }

    for (const [sectionId, turns] of bySection) {
      blocks.push(heading2(humanizeSectionId(sectionId)));
      for (const turn of turns) {
        blocks.push(quote(speakerLabel(turn.speaker), turn.text));
        const hint = deliveryHint(turn.delivery);
        if (hint) blocks.push(paragraph(hint, { italic: true }));
      }
    }

    if (session.audioUrl) {
      blocks.push(divider(), heading2('Audio'));
      blocks.push(paragraph(`Listen: ${session.audioUrl}`));
    }

    return blocks;
  }
}

export const notionBlockRenderer: NotionBlockRenderer = new DefaultNotionBlockRenderer();
