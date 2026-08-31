import { PodcastScriptValidator } from '../src/conversation/podcast-script.validator';
import { ExplanationConversationPlan, PodcastScript } from '../src/domain/models';

describe('PodcastScriptValidator', () => {
  const validator = new PodcastScriptValidator({
    get: (_key: string, defaultValue?: unknown) => defaultValue,
  } as never);

  const explanationPlan: ExplanationConversationPlan = {
    mode: 'EXPLANATION',
    centralQuestion: 'When should we apply backpressure?',
    runningScenario: {
      name: 'Order pipeline',
      description: 'Kafka consumers processing orders',
      components: ['producer', 'broker', 'consumer'],
    },
    deliveryApproach: 'solo_lecture',
    deliveryRationale: 'Linear concept best taught by one narrator.',
    version: '1',
    title: 'Lesson',
    context: {
      companyType: 'SaaS',
      product: 'API',
      initialProblem: 'Scale',
      scale: ['10k rps'],
    },
    objectives: ['Explain Kafka'],
    closing: { finalQuestion: 'What did you learn?', expectedThemes: ['partitions'] },
    sections: [
      {
        id: 'intro',
        episodeBeat: 'HOOK',
        topic: 'Intro',
        objective: 'Define Kafka',
        concept: 'Distributed log',
        examples: ['Producer'],
        realWorldCases: ['Event streaming'],
        speakerMode: 'instructor_solo',
        dialogueReason: null,
        coHostMoments: [],
        keyTakeaways: ['Kafka is a log'],
      },
      {
        id: 'deep-dive',
        episodeBeat: 'DISCOVERY',
        topic: 'Partitions',
        objective: 'Explain partitions',
        concept: 'Sharding',
        examples: ['Key-based routing'],
        realWorldCases: ['Ordering per key'],
        speakerMode: 'instructor_solo',
        dialogueReason: null,
        coHostMoments: [],
        keyTakeaways: ['Partitions enable parallelism'],
      },
      {
        id: 'cases',
        episodeBeat: 'RECAP',
        topic: 'Cases',
        objective: 'Apply concepts',
        concept: 'Production usage',
        examples: ['CDC pipeline'],
        realWorldCases: ['Outbox pattern'],
        speakerMode: 'instructor_solo',
        dialogueReason: null,
        coHostMoments: [],
        keyTakeaways: ['Design for failure'],
      },
    ],
  };

  const buildScript = (durationSeconds: number, turns?: PodcastScript['turns']): PodcastScript => ({
    id: 'script-1',
    title: 'Lesson',
    version: '1',
    estimatedDurationSeconds: durationSeconds,
    turns: turns ?? [
      { id: 't0', speaker: 'INSTRUCTOR', text: 'Intro', sectionId: 'intro', sequence: 0 },
      { id: 't1', speaker: 'INSTRUCTOR', text: 'Partitions', sectionId: 'deep-dive', sequence: 1 },
      { id: 't2', speaker: 'INSTRUCTOR', text: 'Cases', sectionId: 'cases', sequence: 2 },
    ],
  });

  it('accepts explanation scripts without fixed duration or turn quotas', () => {
    expect(() => validator.validate(buildScript(120), explanationPlan, 30)).not.toThrow();
    expect(() => validator.validate(buildScript(7200), explanationPlan, 30)).not.toThrow();
    expect(() =>
      validator.validate(
        buildScript(60, [
          { id: 't0', speaker: 'INSTRUCTOR', text: 'All in one', sectionId: 'intro', sequence: 0 },
          { id: 't1', speaker: 'INSTRUCTOR', text: 'More', sectionId: 'deep-dive', sequence: 1 },
          { id: 't2', speaker: 'INSTRUCTOR', text: 'End', sectionId: 'cases', sequence: 2 },
        ]),
        explanationPlan,
        30,
      ),
    ).not.toThrow();
  });

  it('requires a narrator in explanation mode', () => {
    const script = buildScript(120);
    script.turns = script.turns.map((turn) => ({ ...turn, speaker: 'CO_HOST' as const }));
    expect(() => validator.validate(script, explanationPlan, 30)).toThrow(/narrator/i);
  });

  it('rejects CO_HOST in solo_lecture plans', () => {
    const script = buildScript(120);
    script.turns.push({
      id: 't3',
      speaker: 'CO_HOST',
      text: 'Question?',
      sectionId: 'cases',
      sequence: 3,
    });
    expect(() => validator.validate(script, explanationPlan, 30)).toThrow(/solo_lecture/);
  });

  it('rejects CO_HOST in instructor_solo sections even when delivery allows dialogue', () => {
    const mixedPlan: ExplanationConversationPlan = {
      ...explanationPlan,
      deliveryApproach: 'instructor_with_faq',
      deliveryRationale: 'Selective dialogue at decision points.',
      sections: explanationPlan.sections.map((section, index) =>
        index === 1
          ? {
              ...section,
              speakerMode: 'dialogue' as const,
              dialogueReason: 'comparison' as const,
              coHostMoments: ['Ask whether partitions belong to producers or brokers'],
            }
          : section,
      ),
    };
    const script = buildScript(120, [
      { id: 't0', speaker: 'INSTRUCTOR', text: 'Intro', sectionId: 'intro', sequence: 0 },
      { id: 't1', speaker: 'CO_HOST', text: 'Who owns partitions?', sectionId: 'intro', sequence: 1 },
      { id: 't2', speaker: 'INSTRUCTOR', text: 'Cases', sectionId: 'deep-dive', sequence: 2 },
      { id: 't3', speaker: 'INSTRUCTOR', text: 'End', sectionId: 'cases', sequence: 3 },
    ]);
    expect(() => validator.validate(script, mixedPlan, 30)).toThrow(/instructor_solo/);
  });

  it('allows CO_HOST in dialogue sections', () => {
    const mixedPlan: ExplanationConversationPlan = {
      ...explanationPlan,
      deliveryApproach: 'instructor_with_faq',
      deliveryRationale: 'Selective dialogue at decision points.',
      sections: explanationPlan.sections.map((section, index) =>
        index === 1
          ? {
              ...section,
              speakerMode: 'dialogue' as const,
              dialogueReason: 'comparison' as const,
              coHostMoments: ['Ask whether partitions belong to producers or brokers'],
            }
          : section,
      ),
    };
    const script = buildScript(120, [
      { id: 't0', speaker: 'INSTRUCTOR', text: 'Intro', sectionId: 'intro', sequence: 0 },
      { id: 't1', speaker: 'CO_HOST', text: 'Who owns partitions?', sectionId: 'deep-dive', sequence: 1 },
      {
        id: 't2',
        speaker: 'INSTRUCTOR',
        text: 'Partitions are a broker concern for parallelism.',
        sectionId: 'deep-dive',
        sequence: 2,
      },
      { id: 't3', speaker: 'INSTRUCTOR', text: 'End', sectionId: 'cases', sequence: 3 },
    ]);
    expect(() => validator.validate(script, mixedPlan, 30)).not.toThrow();
  });
});
