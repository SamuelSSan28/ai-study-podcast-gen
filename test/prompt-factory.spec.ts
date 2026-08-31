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
    order: 1,
    level: 'ADVANCED',
    estimatedMinutes: 45,
    scheduledAt: '2026-08-26T12:00:00.000Z',
    studied: false,
  },
  technicalContent: {
    sections: [{ id: 'backpressure', title: 'Backpressure', blocks: [] }],
  },
  targetMinutes: 30,
} satisfies CreateConversationPlanInput;

describe('resolvePrompt', () => {
  it('resolves the interview planner independently', () => {
    const result = resolvePrompt({ stage: 'conversation-plan', mode: 'INTERVIEW', value: input });
    expect(result.version).toContain('interview');
    expect(result.prompt).toContain('realistic');
    expect(result.prompt).toContain('technical interview');
    expect(result.prompt).not.toContain('ENGINEER_A');
  });

  it('resolves the peer discussion planner and its distinct schema', () => {
    const result = resolvePrompt({ stage: 'conversation-plan', mode: 'DISCUSSION', value: input });
    expect(result.version).toContain('discussion');
    expect(result.prompt).toContain('This is not an interview');
    expect(() => result.schema.parse({ mode: 'INTERVIEW' })).toThrow();
  });

  it('resolves the explanation lesson planner with topic-driven delivery', () => {
    const result = resolvePrompt({ stage: 'conversation-plan', mode: 'EXPLANATION', value: input });
    expect(result.version).toContain('explanation');
    expect(result.prompt).toContain('centralQuestion');
    expect(result.prompt).toContain('runningScenario');
    expect(result.prompt).toContain('SOURCE ARTICLE');
    expect(result.prompt).toContain('ARTICLE FIDELITY');
    expect(result.prompt).toContain('SPEAKER POLICY');
    expect(result.prompt).toContain('speakerMode');
  });

  it('resolves the explanation script with transform rules', () => {
    const result = resolvePrompt({
      stage: 'podcast-script',
      mode: 'EXPLANATION',
      value: {
        topic: input.topic,
        content: { sections: [] },
        plan: {
          mode: 'EXPLANATION',
          version: '1',
          title: 'Kafka Backpressure',
          context: {
            companyType: 'Streaming',
            product: 'Pipeline',
            initialProblem: 'Consumer lag',
            scale: ['1M events/s'],
          },
          objectives: ['Handle backpressure'],
          closing: { finalQuestion: 'How do you protect consumers?', expectedThemes: ['pause'] },
          centralQuestion: 'How do you protect consumers?',
          runningScenario: { name: 'App', description: 'One app', components: ['modal'] },
          deliveryApproach: 'solo_lecture',
          deliveryRationale: 'Linear',
          sections: [],
        },
      },
    });
    expect(result.version).toContain('explanation');
    expect(result.prompt).toContain('Transform, do not expand');
    expect(result.prompt).toContain('SOURCE ARTICLE');
    expect(result.prompt).toContain('SPEAKER POLICY');
    expect(result.prompt).toContain('speakerMode');
  });
});
