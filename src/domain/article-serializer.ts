import { ArticleContentBlock } from '../persistence/notion-format.contract';
import { StudyContent } from './models';

function serializeBlock(block: ArticleContentBlock): string {
  switch (block.type) {
    case 'paragraph':
      return block.text;
    case 'heading':
      return `${'#'.repeat(block.level)} ${block.text}`;
    case 'bullet_list':
      return block.items.map((item) => `- ${item}`).join('\n');
    case 'numbered_list':
      return block.items.map((item, index) => `${index + 1}. ${item}`).join('\n');
    case 'quote':
      return `> ${block.text}`;
    case 'callout':
      return `[${block.variant}] ${block.text}`;
    case 'code':
      return `\`\`\`${block.language}\n${block.code}\n\`\`\``;
    case 'divider':
      return '---';
    case 'table':
      return [block.headers.join(' | '), ...block.rows.map((row) => row.join(' | '))].join('\n');
    default:
      return '';
  }
}

/** Plain-text article for planner and script prompts — the canonical teaching source. */
export function serializeArticleForPrompt(content: StudyContent): string {
  const parts: string[] = [];

  for (const section of content.sections) {
    parts.push(`## ${section.title}`);
    for (const block of section.blocks) {
      const text = serializeBlock(block).trim();
      if (text) parts.push(text);
    }
  }

  if (content.reviewQuestions?.length) {
    parts.push('## Review questions');
    parts.push(content.reviewQuestions.map((question) => `- ${question}`).join('\n'));
  }

  return parts.join('\n\n');
}
