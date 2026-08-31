import { notionBlockRenderer } from '../src/persistence/notion-block.renderer';
import { StudyPlanTopic, StudySession } from '../src/domain/models';

describe('NotionBlockRenderer', () => {
  it('renders plan overview without topic bullets', () => {
    const blocks = notionBlockRenderer.renderPlanOverview(
      'This plan covers Kafka fundamentals through applied scenarios.',
      'http://localhost:3000/?plan=p1',
    );
    expect(blocks.some((b) => b.type === 'bulleted_list_item')).toBe(false);
    expect(blocks.some((b) => b.type === 'heading_2')).toBe(true);
    const overview = blocks.find((b) => b.type === 'heading_2');
    expect(overview && 'heading_2' in overview ? overview.heading_2.rich_text[0].text.content : '').toBe(
      'Overview',
    );
  });

  it('renders article without duplicating page title heading', () => {
    const topic = {
      id: 't1',
      studyPlanId: 'p1',
      title: 'Kafka basics',
      slug: 'kafka',
      description: 'Intro',
      week: 1,
      sequence: 1,
      difficulty: 'FOUNDATIONAL',
      tags: [],
      learningObjectives: ['Understand brokers'],
      prerequisites: [],
      depthDelta: '',
      summary: 'Summary of kafka',
      status: 'PLANNED',
      order: 1,
      level: 'FOUNDATION',
      estimatedMinutes: 45,
      scheduledAt: '2026-01-01',
      studied: false,
      articleOutline: {
        sections: [{ id: 'overview', title: 'Overview', promptHint: 'Explain Kafka' }],
      },
    } as StudyPlanTopic;

    const blocks = notionBlockRenderer.renderArticle({
      topic,
      dashboardUrl: 'http://localhost:3000/?plan=p1',
      scriptPageUrl: 'https://notion.so/script',
    });

    const h2 = blocks
      .filter((b) => b.type === 'heading_2')
      .map((b) => ('heading_2' in b ? b.heading_2.rich_text[0].text.content : ''));
    expect(h2).not.toContain('Kafka basics');
    expect(h2).toContain('Podcast script');
  });

  it('renders semantic article blocks to Notion API types', () => {
    const blocks = notionBlockRenderer.renderContentBlocks([
      { type: 'heading', level: 2, text: 'Why idempotency matters' },
      { type: 'paragraph', text: 'Retries are normal in distributed systems.', italic: false },
      { type: 'quote', text: 'Idempotency makes retries safe.' },
      { type: 'callout', variant: 'warning', text: 'Never reuse keys across different operations.' },
      { type: 'code', language: 'typescript', code: 'if (await exists(key)) return cached;' },
      { type: 'bullet_list', items: ['key storage', 'result cache', 'TTL'] },
      { type: 'divider' },
    ]);

    expect(blocks.map((b) => b.type)).toEqual([
      'heading_2',
      'paragraph',
      'quote',
      'callout',
      'code',
      'bulleted_list_item',
      'bulleted_list_item',
      'bulleted_list_item',
      'divider',
    ]);
    const calloutBlock = blocks.find((b) => b.type === 'callout');
    if (calloutBlock && 'callout' in calloutBlock) {
      expect(calloutBlock.callout.icon.emoji).toBe('⚠️');
    }
  });

  it('renders script turns as quote blocks with bold speaker', () => {
    const session = {
      id: 'sess-1',
      title: 'Kafka basics',
      summary: 'Lesson on Kafka',
      script: {
        id: 'script-1',
        title: 'Kafka basics',
        version: '1',
        estimatedDurationSeconds: 600,
        turns: [
          {
            id: 't1',
            sectionId: 'intro',
            sequence: 0,
            speaker: 'INSTRUCTOR',
            text: 'Kafka is a distributed log.',
            delivery: { tone: 'confident', pace: 'medium', emphasis: ['distributed log'] },
          },
        ],
      },
    } as StudySession;

    const blocks = notionBlockRenderer.renderScript(session);
    const quote = blocks.find((b) => b.type === 'quote');
    expect(quote).toBeDefined();
    if (quote && 'quote' in quote) {
      expect(quote.quote.rich_text[0].annotations?.bold).toBe(true);
      expect(quote.quote.rich_text[0].text.content).toContain('Instructor:');
    }
    const italic = blocks.find(
      (b) =>
        b.type === 'paragraph' &&
        'paragraph' in b &&
        b.paragraph.rich_text[0]?.annotations?.italic,
    );
    expect(italic).toBeDefined();
  });

  it('normalizes unsupported code aliases to Notion-safe languages', () => {
    const cases: Array<{ language: string; expected: string }> = [
      { language: 'jsx', expected: 'javascript' },
      { language: 'tsx', expected: 'typescript' },
      { language: 'react', expected: 'javascript' },
      { language: 'JSX', expected: 'javascript' },
      { language: 'dockerfile', expected: 'docker' },
      { language: 'postgresql', expected: 'sql' },
      { language: 'foobar', expected: 'plain text' },
      { language: '', expected: 'plain text' },
    ];

    for (const { language, expected } of cases) {
      const block = notionBlockRenderer.renderContentBlocks([
        { type: 'code', language, code: 'const x = 1;' },
      ])[0];
      expect(block.type).toBe('code');
      if (block.type === 'code') {
        expect(block.code.language).toBe(expected);
      }
    }
  });
});
