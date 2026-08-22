import { PlanGenerationInput } from '../../application/ports';
import { StudyContent, StudyPlanTopic } from '../../domain/models';
export const PROMPT_VERSIONS = {
  plan: 'study-plan.v1',
  content: 'study-content.v1',
  script: 'podcast-script.v1',
  duplicate: 'duplicate.v1',
} as const;
export function buildPlanPrompt(input: PlanGenerationInput, context: string): string {
  return `Create a coherent English backend interview study roadmap for ${input.durationWeeks} weeks and ${input.sessionsPerWeek} sessions per week. Goal: ${input.goal}. Level: ${input.level}. Each topic must be one concrete production use case, build on earlier sessions, and progress from foundations to distributed-system incidents. Return exactly ${input.durationWeeks * input.sessionsPerWeek} ordered topics. Local context (use only when relevant):\n${context}`;
}
export function buildContentPrompt(topic: StudyPlanTopic, context: string): string {
  return `Write an English production engineering deep dive for the concrete scenario "${topic.title}": ${topic.description}. Cover requirements, assumptions, architecture and evolution, APIs/data ownership/async communication when relevant, consistency, concurrency, idempotency, retries, backpressure, caching, scalability, observability, SLI/SLO, CI/CD, deployment, incidents, trade-offs, an ASCII diagram, mistakes, B2-C1 vocabulary, review questions, and an optional challenge. Do not mechanically force technologies that do not fit.\nRelevant local sources:\n${context}`;
}
export function buildScriptPrompt(
  topic: StudyPlanTopic,
  content: StudyContent,
  minutes: number,
): string {
  return `Create a self-contained ${minutes}-minute natural technical interview about ${topic.title}. Use ordered INTERVIEWER and CANDIDATE turns; HOST is allowed only for a short opening/closing. The interviewer gradually reveals constraints and challenges decisions. The candidate asks clarifying questions, thinks aloud, explains trade-offs, and may reconsider. Spoken English must be B2-C1 and concise. Never refer to study material, a document, prompt, lesson, or exercise. Source deep dive:\n${JSON.stringify(content)}`;
}
