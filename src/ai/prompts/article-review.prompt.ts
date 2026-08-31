import { ArticleReview, StudyContent, StudyPlanTopic, TopicResearch } from '../../domain/models';
import { formatLearningObjectives } from './scope-discipline';

export const ARTICLE_REVIEW_PROMPT_VERSION = 'article-review.v1';
export const ARTICLE_REVISION_PROMPT_VERSION = 'article-revision.v1';

export function buildArticleReviewPrompt(
  topic: StudyPlanTopic,
  research: TopicResearch,
  article: StudyContent,
): string {
  return `Review this didactic article as a quality gate. Do not rewrite it.

TOPIC: ${topic.title} — ${topic.description}
LEARNING OBJECTIVES
${formatLearningObjectives(topic)}
SOURCE RESEARCH: ${JSON.stringify(research)}
ARTICLE: ${JSON.stringify(article)}

Check only whether every section contributes to this lesson; concepts appear in progressive
dependency order; objectives are taught rather than mentioned; every major concept explains what
it is, why and when it matters, its important boundary, and its retained mental model; adjacent or
future topics are absent; examples do pedagogical work; and repetition adds new insight.

Return approved=true and an empty issues array when no targeted revision is necessary. Otherwise
return concise, actionable issues using only scope, progression, coverage, clarity, repetition, or
example_overuse. Use a sectionId when the issue belongs to a section. Do not request a new outline.`;
}

export function buildArticleRevisionPrompt(
  topic: StudyPlanTopic,
  research: TopicResearch,
  article: StudyContent,
  review: ArticleReview,
): string {
  return `Revise the existing article only where the review issues require it. Preserve its useful
content, stable section ids, semantic block representation, scope, and source-grounded claims.
Do not create a new plan or expand into adjacent concepts.

TOPIC: ${topic.title} — ${topic.description}
LEARNING OBJECTIVES
${formatLearningObjectives(topic)}
SOURCE RESEARCH: ${JSON.stringify(research)}
ORIGINAL ARTICLE: ${JSON.stringify(article)}
TARGETED REVIEW ISSUES: ${JSON.stringify(review.issues)}

Return the complete corrected article with sections and semantic blocks.`;
}
