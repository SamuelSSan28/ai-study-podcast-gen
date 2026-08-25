import { PlanGenerationInput } from '../../application/ports';
import { StudyContent, StudyPlanTopic } from '../../domain/models';
export const PROMPT_VERSIONS = {
  plan: 'study-plan.v2',
  content: 'study-content.v2',
  script: 'podcast-script.v1',
  duplicate: 'duplicate.v1',
} as const;
export function buildPlanPrompt(input: PlanGenerationInput, context: string): string {
  return `Create a complete, progressive English curriculum titled "${input.title}" for this goal: ${input.goal}. It has ${input.durationWeeks} weeks and ${input.sessionsPerWeek} sessions per week. Return exactly ${input.durationWeeks * input.sessionsPerWeek} ordered topics. Progress through FOUNDATION, CORE, INTERMEDIATE, ADVANCED, and APPLIED work, ending in a realistic use case or practical/interview application. Every topic must be independently studyable in one ${input.targetSessionMinutes}-minute session and must never require more than 60 minutes; split broad subjects (for example Kafka) into focused concepts such as fundamentals, partitions, groups, offsets, rebalancing, and delivery semantics. Objectives must be concrete, prerequisites must refer to earlier topic titles, and adjacent sessions must advance rather than repeat. Local context (use only when relevant):\n${context}`;
}
export function buildContentPrompt(topic: StudyPlanTopic, context: string): string {
  return `Write an English article for "${topic.title}": ${topic.description}. Target approximately ${topic.estimatedMinutes} minutes for the complete article-plus-audio session. Cover requirements, assumptions, architecture and evolution, APIs/data ownership/async communication when relevant, consistency, concurrency, idempotency, retries, scalability, observability, incidents, trade-offs, mistakes, vocabulary, and review questions. Do not force irrelevant technologies. The supplied research is the factual source of truth for both article and podcast; do not contradict it, and represent its sources in the content.\nResearch and local context:\n${context}`;
}
export function buildScriptPrompt(
  topic: StudyPlanTopic,
  content: StudyContent,
  minutes: number,
): string {
  return `Create a self-contained ${minutes}-minute natural technical interview about ${topic.title}. Use ordered INTERVIEWER and CANDIDATE turns; HOST is allowed only for a short opening/closing. The interviewer gradually reveals constraints and challenges decisions. The candidate asks clarifying questions, thinks aloud, explains trade-offs, and may reconsider. Spoken English must be B2-C1 and concise. Never refer to study material, a document, prompt, lesson, or exercise. Source deep dive:\n${JSON.stringify(content)}`;
}
