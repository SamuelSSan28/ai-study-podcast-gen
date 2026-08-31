import { explanationConversationPlanSchema } from '../src/ai/schemas';
import { EXPLANATION_SPEAKER_POLICY } from '../src/ai/prompts/explanation/speaker-policy';
import { buildContentPrompt } from '../src/ai/prompts/prompts';
import { StudyPlanTopic } from '../src/domain/models';

const basePlan = {
  mode: 'EXPLANATION' as const,
  version: '1',
  title: 'useState foundations',
  context: {
    companyType: 'SaaS',
    product: 'Dashboard',
    initialProblem: 'Local UI state',
    scale: ['1 team'],
  },
  objectives: ['Decide when to use useState'],
  incident: null,
  closing: { finalQuestion: 'When does a value deserve state?', expectedThemes: ['persistence'] },
  centralQuestion: 'When should a value live in useState?',
  runningScenario: {
    name: 'SearchBox',
    description: 'A search field filtering a product list',
    components: ['SearchBox', 'ProductsList', 'query'],
  },
  deliveryApproach: 'instructor_with_faq' as const,
  deliveryRationale: 'Foundations solo; dialogue at lifting-state decision.',
};

function soloSection(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    articleSectionId: 'discovery',
    purpose: 'Teach what useState means',
    speakerMode: 'instructor_solo',
    dialogueReason: null,
    recap: false,
    ...overrides,
  };
}

function fiveSections(middle: Record<string, unknown>): Array<Record<string, unknown>> {
  return [
    soloSection({ articleSectionId: 'hook' }),
    soloSection({ articleSectionId: 'promise' }),
    soloSection({ articleSectionId: 'setup' }),
    soloSection(middle),
    soloSection({ articleSectionId: 'recap', recap: true }),
  ];
}

describe('explanation speaker policy schema', () => {
  it('exports the SPEAKER POLICY constant', () => {
    expect(EXPLANATION_SPEAKER_POLICY).toContain('SPEAKER POLICY');
    expect(EXPLANATION_SPEAKER_POLICY).toContain('Narration to teach');
  });

  it('requires dialogueReason when speakerMode is dialogue', () => {
    const result = explanationConversationPlanSchema.safeParse({
      ...basePlan,
      sections: fiveSections({
        speakerMode: 'dialogue',
        dialogueReason: null,
        coHostMoments: ['Ask if query stays in SearchBox'],
      }),
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.message).toMatch(/dialogueReason/);
    }
  });

  it('rejects dialogueReason on instructor_solo sections', () => {
    const result = explanationConversationPlanSchema.safeParse({
      ...basePlan,
      sections: fiveSections({
        speakerMode: 'instructor_solo',
        dialogueReason: 'comparison',
      }),
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.message).toMatch(/dialogueReason/);
    }
  });

  it('accepts dialogue sections with dialogueReason', () => {
    const result = explanationConversationPlanSchema.safeParse({
      ...basePlan,
      sections: fiveSections({
        articleSectionId: 'lift',
        speakerMode: 'dialogue',
        dialogueReason: 'decision',
      }),
    });
    expect(result.success).toBe(true);
  });

  it('accepts a thin plan without legacy narrative metadata', () => {
    const result = explanationConversationPlanSchema.safeParse({
      mode: 'EXPLANATION',
      version: '1',
      title: 'useState',
      sections: fiveSections({}),
    });
    expect(result.success).toBe(true);
  });
});

describe('article structure hint for speaker cadence', () => {
  const topic = {
    id: 't1',
    studyPlanId: 'p1',
    title: 'useState',
    slug: 'usestate',
    description: 'Local component state',
    week: 1,
    sequence: 1,
    difficulty: 'FOUNDATIONAL',
    tags: ['react'],
    learningObjectives: ['Decide when to use useState'],
    prerequisites: [],
    depthDelta: 'State basics',
    summary: 'useState',
    status: 'PLANNED',
    order: 1,
    level: 'FOUNDATION',
    estimatedMinutes: 40,
    scheduledAt: '2026-08-31T12:00:00.000Z',
    studied: false,
  } satisfies StudyPlanTopic;

  it('asks the article to separate foundations from decision points', () => {
    const prompt = buildContentPrompt(topic, 'research');
    expect(prompt).toContain('foundational explanations');
    expect(prompt).toContain('decision points');
    expect(prompt).toContain('solo narration');
  });
});
