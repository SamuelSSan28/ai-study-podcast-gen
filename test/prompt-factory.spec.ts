import { resolvePrompt } from '../src/ai/prompts/prompt.factory';
import { CreateConversationPlanInput } from '../src/domain/models';

const input = {
  studyPlanContext: { title: 'Kafka', goal: 'Learn backpressure', level: 'senior' },
  topic: {
    id: 'topic-1',
    studyPlanId: 'plan-1',
    title: 'Kafka Backpressure',
    slug: 'kafka-backpressure',
    description: 'Protect consumers under load',
    week: 1,
    sequence: 1,
    difficulty: 'ADVANCED',
    tags: ['kafka'],
    learningObjectives: [],
    prerequisites: [],
    depthDelta: 'Backpressure',
    summary: 'Backpressure strategies',
    status: 'PLANNED',
  },
  technicalContent: {
    overview: 'Overview',
    businessContext: 'Context',
    requirements: [],
    assumptions: [],
    architecture: 'Architecture',
    architectureEvolution: [],
    decisions: [],
    failureScenarios: [],
    observability: [],
    slos: [],
    tradeoffs: [],
    vocabulary: [],
    reviewQuestions: [],
  },
  targetMinutes: 30,
} satisfies CreateConversationPlanInput;

describe('resolvePrompt', () => {
  it('resolves the interview planner independently', () => {
    const result = resolvePrompt({ stage: 'conversation-plan', mode: 'INTERVIEW', value: input });
    expect(result.version).toContain('interview');
    expect(result.prompt).toContain('senior backend engineering interview');
    expect(result.prompt).not.toContain('ENGINEER_A');
  });

  it('resolves the peer discussion planner and its distinct schema', () => {
    const result = resolvePrompt({ stage: 'conversation-plan', mode: 'DISCUSSION', value: input });
    expect(result.version).toContain('discussion');
    expect(result.prompt).toContain('This is not an interview');
    expect(() => result.schema.parse({ mode: 'INTERVIEW' })).toThrow();
  });
});
