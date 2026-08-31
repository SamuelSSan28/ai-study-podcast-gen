import {
  buildArticlePlannerPrompt,
  buildArticleSectionPrompt,
  buildArticleSectionReviewPrompt,
} from '../src/ai/prompts/article-generation.prompt';
import { buildExplanationSectionAdapterPrompt } from '../src/ai/prompts/explanation/section-adapter.prompt';
import {
  ArticleGenerationState,
  ArticleLessonPlan,
  StudyPlanTopic,
  TopicResearch,
} from '../src/domain/models';

const topic = {
  id: 't1',
  studyPlanId: 'p1',
  title: 'State ownership',
  slug: 'state-ownership',
  description: 'Choose where local state belongs',
  week: 1,
  sequence: 1,
  difficulty: 'FOUNDATIONAL',
  tags: ['react'],
  learningObjectives: ['Distinguish stored and derived values'],
  prerequisites: [],
  depthDelta: 'Local state',
  summary: 'State ownership',
  status: 'PLANNED',
  order: 1,
  level: 'FOUNDATION',
  estimatedMinutes: 40,
  scheduledAt: '2026-08-31T12:00:00.000Z',
  studied: false,
} satisfies StudyPlanTopic;
const research: TopicResearch = {
  summary: 'State is component memory.',
  keyConcepts: ['state'],
  sources: [],
};
const plan: ArticleLessonPlan = {
  lessonGoal: 'Choose what to store',
  centralQuestion: 'What deserves state?',
  progression: [
    {
      id: 'meaning',
      title: 'State meaning',
      teachingGoal: 'Define state',
      dependsOn: [],
      introduces: ['state'],
      boundaries: ['not every value'],
    },
    {
      id: 'derived',
      title: 'Derived values',
      teachingGoal: 'Avoid duplicate state',
      dependsOn: ['meaning'],
      introduces: ['derived values'],
      boundaries: ['computed values'],
    },
  ],
};
const state: ArticleGenerationState = {
  centralQuestion: plan.centralQuestion,
  conceptsEstablished: ['state'],
  terminologyEstablished: [{ term: 'state', meaning: 'render memory' }],
  examplesAlreadyUsed: ['counter'],
  previousSectionSummary: 'State preserves information between renders.',
};

describe('modular generation prompts', () => {
  it('keeps the article planner focused on concept order rather than article prose', () => {
    const prompt = buildArticlePlannerPrompt(topic, research);
    expect(prompt).toContain('WHAT concepts');
    expect(prompt).toContain('dependency order');
    expect(prompt).toContain('Do not write article prose');
  });

  it('gives a section writer compact prior and future scope context', () => {
    const prompt = buildArticleSectionPrompt({
      topic,
      research,
      plan,
      sectionPlan: plan.progression[1],
      state,
      futureConcepts: ['state ownership'],
    });
    expect(prompt).toContain('CONCEPTS ALREADY ESTABLISHED');
    expect(prompt).toContain('FUTURE CONCEPTS NOT YET ALLOWED');
    expect(prompt).toContain('Teach only the concepts assigned');
  });

  it('separates local section review from rewriting', () => {
    const prompt = buildArticleSectionReviewPrompt({
      sectionPlan: plan.progression[1],
      section: {
        id: 'derived',
        title: 'Derived values',
        blocks: [{ type: 'paragraph', text: 'Compute totals.', italic: false }],
      },
      stateBefore: state,
      futureConcepts: ['lifting state'],
    });
    expect(prompt).toContain('Review one article section');
    expect(prompt).toContain('Do not rewrite');
    expect(prompt).toContain('future_scope');
  });

  it('makes the podcast adapter transform one canonical section without anticipation', () => {
    const prompt = buildExplanationSectionAdapterPrompt({
      articleGoal: plan.lessonGoal,
      articleSection: {
        id: 'derived',
        title: 'Derived values',
        blocks: [{ type: 'paragraph', text: 'Compute totals.', italic: false }],
      },
      futureSections: [{ id: 'ownership', title: 'Ownership', blocks: [] }],
      sectionPlan: {
        articleSectionId: 'derived',
        purpose: 'Explain the boundary',
        speakerMode: 'instructor_solo',
        dialogueReason: null,
        dialoguePrompt: null,
        recap: false,
      },
      state: {
        previousSectionClosing: '',
        terminology: state.terminologyEstablished,
        examplesAlreadyUsed: [],
        speakerContext: '',
      },
    });
    expect(prompt).toContain('Transform ONE canonical article section');
    expect(prompt).toContain('Transform, do not expand');
    expect(prompt).toContain('not yet allowed');
  });
});
