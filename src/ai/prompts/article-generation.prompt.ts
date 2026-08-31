import {
  ArticleGenerationState,
  ArticleLessonPlan,
  ArticleLessonSectionPlan,
  SectionReview,
  StudyArticleSection,
  StudyPlanTopic,
  TopicResearch,
} from '../../domain/models';
import { formatLearningObjectives } from './scope-discipline';

export const ARTICLE_PLANNER_PROMPT_VERSION = 'article-planner.v1';
export const ARTICLE_SECTION_PROMPT_VERSION = 'article-section-writer.v1';
export const ARTICLE_SECTION_REVIEW_PROMPT_VERSION = 'article-section-review.v1';
export const ARTICLE_SECTION_REVISION_PROMPT_VERSION = 'article-section-revision.v1';

export function buildArticlePlannerPrompt(topic: StudyPlanTopic, research: TopicResearch): string {
  return `Plan a progressive technical lesson. Do not write article prose and do not choose block types.

TOPIC: ${topic.title} — ${topic.description}
LEARNING OBJECTIVES
${formatLearningObjectives(topic)}
SOURCE RESEARCH: ${JSON.stringify(research)}

Decide only WHAT concepts must be taught and in WHAT dependency order. Learning objectives are
coverage requirements, not headings. Return lessonGoal, one centralQuestion, and a concise progression.
Each progression item needs a stable kebab-case id, natural title, teachingGoal, dependsOn ids,
concepts introduced in that section, and important boundaries. Include only source-supported concepts
needed for this lesson. Do not add adjacent tools, future curriculum, examples, code, or presentation blocks.`;
}

export function buildArticleSectionPrompt(input: {
  topic: StudyPlanTopic;
  research: TopicResearch;
  plan: ArticleLessonPlan;
  sectionPlan: ArticleLessonSectionPlan;
  state: ArticleGenerationState;
  futureConcepts: string[];
}): string {
  return `Write ONE conceptual step of a larger article lesson.

ARTICLE GOAL: ${input.plan.lessonGoal}
CENTRAL QUESTION: ${input.plan.centralQuestion}
CURRENT SECTION PLAN: ${JSON.stringify(input.sectionPlan)}
CONCEPTS ALREADY ESTABLISHED: ${JSON.stringify(input.state.conceptsEstablished)}
TERMINOLOGY ESTABLISHED: ${JSON.stringify(input.state.terminologyEstablished)}
EXAMPLES ALREADY USED: ${JSON.stringify(input.state.examplesAlreadyUsed)}
PREVIOUS SECTION SUMMARY: ${input.state.previousSectionSummary || '(first section)'}
FUTURE CONCEPTS NOT YET ALLOWED: ${JSON.stringify(input.futureConcepts)}
SOURCE RESEARCH: ${JSON.stringify(input.research)}

Teach only the concepts assigned to this section. Explain what they are, why the learner needs them,
their important boundary, and how they follow from established knowledge. Use an example or code only
if it materially improves understanding; prefer not to repeat an existing example. Future concepts may
be named only when strictly necessary for a transition—do not teach them yet. Naturally prepare the
next step without previewing its explanation.

Return section.id exactly "${input.sectionPlan.id}" and use its planned title. Return semantic blocks,
plus the complete compact generation state after this section. The state must summarize facts actually
taught, stable terminology, examples actually used, and this section's closing summary. Do not put
state metadata into article prose. Topic context: ${input.topic.title}.`;
}

export function buildArticleSectionReviewPrompt(input: {
  sectionPlan: ArticleLessonSectionPlan;
  section: StudyArticleSection;
  stateBefore: ArticleGenerationState;
  futureConcepts: string[];
}): string {
  return `Review one article section. Do not rewrite it.

SECTION PLAN: ${JSON.stringify(input.sectionPlan)}
STATE BEFORE SECTION: ${JSON.stringify(input.stateBefore)}
FUTURE CONCEPTS: ${JSON.stringify(input.futureConcepts)}
GENERATED SECTION: ${JSON.stringify(input.section)}

Approve only if the section teaches its assigned step clearly, follows from prior knowledge, establishes
its boundary, avoids repetition, and does not teach future or unrelated concepts. Return concise issues.
Use future_scope specifically when later concepts are taught prematurely. If no correction is needed,
return approved=true with an empty issues array.`;
}

export function buildArticleSectionRevisionPrompt(input: {
  sectionPlan: ArticleLessonSectionPlan;
  original: StudyArticleSection;
  review: SectionReview;
  state: ArticleGenerationState;
  futureConcepts: string[];
}): string {
  return `Correct only the listed issues in this article section. Preserve its id, useful content,
semantic block representation, established terminology, and assigned teaching scope. Do not add future
concepts or unrelated information.

SECTION PLAN: ${JSON.stringify(input.sectionPlan)}
STATE BEFORE: ${JSON.stringify(input.state)}
FUTURE CONCEPTS: ${JSON.stringify(input.futureConcepts)}
ORIGINAL SECTION: ${JSON.stringify(input.original)}
ISSUES: ${JSON.stringify(input.review.issues)}

Return the corrected section and the complete compact state after that corrected section.`;
}
