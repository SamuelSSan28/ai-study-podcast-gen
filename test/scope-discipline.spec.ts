import { buildContentPrompt } from '../src/ai/prompts/prompts';
import { buildExplanationScriptPrompt } from '../src/ai/prompts/explanation/lesson-script.prompt';
import { buildExplanationPlannerPrompt } from '../src/ai/prompts/explanation/lesson-planner.prompt';
import {
  ARTICLE_SCOPE_DISCIPLINE,
  SCRIPT_TRANSFORM_RULES,
  PLANNER_ARTICLE_FIDELITY,
} from '../src/ai/prompts/scope-discipline';
import { ExplanationConversationPlan, StudyContent, StudyPlanTopic } from '../src/domain/models';

const topic: StudyPlanTopic = {
  id: 'topic-1',
  studyPlanId: 'plan-1',
  title: 'React State Taxonomy',
  slug: 'react-state-taxonomy',
  description: 'UI, Server, URL and Client State',
  week: 1,
  sequence: 1,
  difficulty: 'INTERMEDIATE',
  tags: ['react'],
  learningObjectives: ['Classify state by owner and lifecycle'],
  prerequisites: [],
  depthDelta: '',
  summary: '',
  status: 'PLANNED',
  order: 1,
  level: 'CORE',
  estimatedMinutes: 45,
  scheduledAt: '2026-01-01',
  studied: false,
};

const article: StudyContent = {
  sections: [
    {
      id: 'ui-state',
      title: 'UI State',
      blocks: [{ type: 'paragraph', text: 'Local UI state.', italic: false }],
    },
  ],
};

describe('scope discipline prompts', () => {
  it('includes article scope discipline in content prompt', () => {
    const prompt = buildContentPrompt(topic, 'research context');
    expect(prompt).toContain(ARTICLE_SCOPE_DISCIPLINE);
    expect(prompt).toContain('Classify state by owner and lifecycle');
    expect(prompt).toContain('podcast script will be generated from this article');
  });

  it('includes article fidelity in explanation planner prompt', () => {
    const prompt = buildExplanationPlannerPrompt({
      studyPlanContext: { title: 'React', goal: 'Learn state', level: 'intermediate' },
      topic,
      technicalContent: article,
      targetMinutes: 30,
    });
    expect(prompt).toContain(PLANNER_ARTICLE_FIDELITY);
    expect(prompt).toContain('SOURCE ARTICLE');
    expect(prompt).not.toContain('Technical source');
  });

  it('includes transform rules and source article in explanation script prompt', () => {
    const prompt = buildExplanationScriptPrompt(topic, article, {
      mode: 'EXPLANATION',
      version: '1',
      title: 'React State Taxonomy',
      context: {
        companyType: 'SaaS',
        product: 'Dashboard',
        initialProblem: 'Classify state',
        scale: ['10k users'],
      },
      objectives: ['Classify state'],
      closing: { finalQuestion: 'Where does this value live?', expectedThemes: ['ownership'] },
      centralQuestion: 'Where should this value live?',
      runningScenario: { name: 'Dashboard', description: 'One screen', components: ['modal'] },
      deliveryApproach: 'solo_lecture',
      deliveryRationale: 'Linear taxonomy',
      sections: [],
    } satisfies ExplanationConversationPlan);
    expect(prompt).toContain(SCRIPT_TRANSFORM_RULES);
    expect(prompt).toContain('Transform, do not expand');
    expect(prompt).toContain('SOURCE ARTICLE');
    expect(prompt).toContain('React State Taxonomy');
    expect(prompt).not.toContain('Technical source');
  });
});
