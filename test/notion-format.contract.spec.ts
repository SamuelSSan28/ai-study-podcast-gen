import { NOTION_FORMAT_VERSION, NOTION_PLAN_OVERVIEW_RULES } from '../src/persistence/notion-format.contract';
import { buildContentPrompt, buildPlanPrompt } from '../src/ai/prompts/prompts';

describe('notion-format.contract', () => {
  it('exports a version string', () => {
    expect(NOTION_FORMAT_VERSION).toMatch(/^notion-format\./);
  });

  it('is injected into plan and content prompts', () => {
    const planPrompt = buildPlanPrompt({
      title: 'Kafka',
      goal: 'Learn streaming',
      durationWeeks: 6,
      sessionsPerWeek: 3,
      preferredDays: ['MONDAY'],
      targetSessionMinutes: 45,
    });
    expect(planPrompt).toContain(NOTION_PLAN_OVERVIEW_RULES);

    const contentPrompt = buildContentPrompt(
      {
        id: 't1',
        studyPlanId: 'p1',
        title: 'Offsets',
        slug: 'offsets',
        description: 'Consumer offsets',
        week: 1,
        sequence: 1,
        difficulty: 'INTERMEDIATE',
        tags: [],
        learningObjectives: [],
        prerequisites: [],
        depthDelta: '',
        summary: '',
        status: 'PLANNED',
        order: 1,
        level: 'CORE',
        estimatedMinutes: 45,
        scheduledAt: '2026-01-01',
        studied: false,
      },
      'research context',
    );
    expect(contentPrompt).toContain('Never repeat the page title as H1');
    expect(contentPrompt).toContain('Never use jsx, tsx, react');
    expect(contentPrompt).toContain('Notion-supported language');
  });
});
