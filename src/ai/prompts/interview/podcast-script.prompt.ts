import { InterviewConversationPlan, StudyContent } from '../../../domain/models';

export const INTERVIEW_SCRIPT_PROMPT_VERSION = 'podcast-script.interview.v3';

export function buildInterviewScriptPrompt(
  content: StudyContent,
  plan: InterviewConversationPlan,
): string {
  return `Turn this plan into a natural technical interview between INTERVIEWER and CANDIDATE.

The interviewer asks concise questions, challenges assumptions, reveals constraints progressively, and follows up on the previous answer rather than approving everything. The candidate asks clarifying questions, thinks aloud, justifies trade-offs, and occasionally revises an earlier decision. Use natural B2-C1 spoken English.

Avoid trivia, textbook answers, oversized monologues, perfect immediate answers, and references to prompts, lessons, documents, or study material. Return structured turns with stable ids, zero-based sequence, section ids, delivery direction, and a duration estimate.

Technical source: ${JSON.stringify(content)}
Interview plan: ${JSON.stringify(plan)}`;
}
