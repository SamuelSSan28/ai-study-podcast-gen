import { PlanGenerationInput } from '../../application/ports';
import { StudyPlanTopic } from '../../domain/models';
import { seedArticleOutline } from '../../domain/article-outline';
import {
  NOTION_ARTICLE_RULES,
  NOTION_PLAN_OVERVIEW_RULES,
} from '../../persistence/notion-format.contract';
import { ARTICLE_SCOPE_DISCIPLINE, formatLearningObjectives } from './scope-discipline';

export const PROMPT_VERSIONS = {
  plan: 'study-plan.v4',
  content: 'study-content.v6',
  script: 'podcast-script.v2',
  duplicate: 'duplicate.v1',
} as const;
export function buildPlanPrompt(input: PlanGenerationInput): string {
  return `Create a complete, progressive curriculum titled "${input.title}" for this goal: ${input.goal}. It spans ${input.durationWeeks} weeks with ${input.sessionsPerWeek} sessions per week. Return exactly ${input.durationWeeks * input.sessionsPerWeek} ordered topics. Progress through FOUNDATION, CORE, INTERMEDIATE, ADVANCED, and APPLIED, ending in a realistic use case or practical/interview application. Each topic must be independently studyable in one session; set estimatedMinutes (30–60) based on topic complexity rather than a fixed duration. Split broad subjects (for example Kafka) into focused concepts such as fundamentals, partitions, consumer groups, offsets, rebalancing, and delivery semantics. Titles, descriptions, objectives, and prerequisites must read naturally for spoken technical study. Objectives must be concrete, prerequisites must reference earlier titles, and adjacent sessions must advance rather than repeat.

${NOTION_PLAN_OVERVIEW_RULES}`;
}
export function buildContentPrompt(topic: StudyPlanTopic, context: string): string {
  const outline = seedArticleOutline(topic);
  const sectionGuide = outline.sections
    .map((section) => `- ${section.title}${section.promptHint ? `: ${section.promptHint}` : ''}`)
    .join('\n');
  const objectives = formatLearningObjectives(topic);

  return `Write a didactic technical article for "${topic.title}": ${topic.description}.
Explain concepts clearly for a learner — like a well-structured class write-up, not a transcript.

LEARNING OBJECTIVES
${objectives}

Suggested section structure (adapt section titles only if learning objectives require it):
${sectionGuide}

${ARTICLE_SCOPE_DISCIPLINE}

Structure sections so foundational explanations (definitions, mental models, short examples) are clearly separated from decision points (comparisons, trade-offs, "when to choose X vs Y"). The podcast script will use solo narration for foundations and dialogue only at decision points.

The provided research is the factual source for this article; do not contradict it and represent its sources in the content. The podcast script will be generated from this article — do not write content meant only for spoken delivery.

Research and local context:
${context}

${NOTION_ARTICLE_RULES}

Return structured sections with semantic blocks (paragraph, heading, bullet_list, numbered_list, quote, callout, code, divider, table).
Each section must directly serve the learning objectives.`;
}
