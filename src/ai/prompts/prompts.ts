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
  content: 'study-content.v8',
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

The learning objectives are coverage requirements, not an automatic table of contents.
Design the pedagogical progression yourself.

Optional structural scaffold:
${sectionGuide}
Do not use these labels as article headings. Adapt the structure to the lesson.

Build the article as a progressive lesson, not as a list of learning objectives. The learner
should feel that each major concept answers a question created by the previous concept.
Use this as a pedagogical scaffold, not mandatory headings: establish the problem or motivation;
introduce the concept needed to understand it; explain how it works; establish its important
boundary or distinction; connect it naturally to the next concept; use an example or code when
it materially improves understanding; and reinforce the mental model the learner should retain.
Do not create one section for every item above or mechanically repeat this sequence per concept.

For every major concept, make clear what it is, why it exists or what problem it solves, when it
matters, its important boundary or distinction, and the mental model to retain. These are
completeness criteria. Do not expose them as repetitive headings or checklists.

${ARTICLE_SCOPE_DISCIPLINE}

Structure sections so foundational explanations (definitions, mental models, short examples) are clearly separated from decision points (comparisons, trade-offs, "when to choose X vs Y"). The podcast script will use solo narration for foundations and dialogue only at decision points.

Examples and code are teaching tools, not structural requirements. Use an example only when it
makes a concept more concrete or introduces a new insight. Prefer one strong example over several
equivalent examples. For programming concepts, prefer explanation → relevant code → explain what
the learner should notice. Never repeat a mechanical concept/example/code/explanation template.

The provided research is the factual source for this article; do not contradict it and represent its sources in the content. The podcast script will be generated from this article — do not write content meant only for spoken delivery.

Research and local context:
${context}

${NOTION_ARTICLE_RULES}

Return structured sections with semantic blocks (paragraph, heading, bullet_list, numbered_list, quote, callout, code, divider, table).
Each section must directly serve the learning objectives.`;
}
