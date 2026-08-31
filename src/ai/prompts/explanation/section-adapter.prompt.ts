import {
  ExplanationSection,
  PodcastGenerationState,
  StudyArticleSection,
  StudyContent,
} from '../../../domain/models';

export const EXPLANATION_SECTION_ADAPTER_PROMPT_VERSION = 'section-adapter.explanation.v1';

export function buildExplanationSectionAdapterPrompt(input: {
  articleGoal: string;
  articleSection: StudyArticleSection;
  futureSections: StudyContent['sections'];
  sectionPlan: ExplanationSection;
  state: PodcastGenerationState;
}): string {
  return `Transform ONE canonical article section into spoken educational content.

ARTICLE GOAL: ${input.articleGoal}
CANONICAL ARTICLE SECTION: ${JSON.stringify(input.articleSection)}
DELIVERY PLAN: ${JSON.stringify(input.sectionPlan)}
PREVIOUS AUDIO STATE: ${JSON.stringify(input.state)}
FUTURE ARTICLE SECTIONS (not yet allowed): ${JSON.stringify(
    input.futureSections.map(({ id, title }) => ({ id, title })),
  )}

The article section is the only technical source. You may simplify sentences, create a natural spoken
transition, ask a short reflection question, recap an idea already present, and create dialogue only
when speakerMode is dialogue. You may not add concepts, tools, libraries, architecture advice, another
example containing new technical information, or anticipate future sections. Transform, do not expand.

For instructor_solo, emit only INSTRUCTOR. For dialogue, CO_HOST must express the specified
misconception/comparison/tradeoff/decision and must contribute reasoning—never agreement or paraphrase.
Use sectionId exactly "${input.articleSection.id}" for every turn. Return local zero-based contiguous
turn sequences and semantic delivery style only; do not generate pause milliseconds or pace.
Also return the complete delivery-only state: closing phrase/idea, unchanged established terminology,
examples reused from the article, and minimal speaker continuity. This state must not add knowledge.`;
}
