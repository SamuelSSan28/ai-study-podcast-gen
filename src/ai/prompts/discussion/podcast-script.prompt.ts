import { DiscussionConversationPlan, StudyContent } from '../../../domain/models';

export const DISCUSSION_SCRIPT_PROMPT_VERSION = 'podcast-script.discussion.v1';

export function buildDiscussionScriptPrompt(
  content: StudyContent,
  plan: DiscussionConversationPlan,
): string {
  return `Turn this plan into a natural technical podcast conversation between ENGINEER_A and ENGINEER_B. They are competent peers.

Both introduce ideas, react to the previous turn, ask natural questions, challenge assumptions, complement reasoning, occasionally disagree, suggest alternatives, and revisit decisions as constraints appear. Avoid question → complete answer → next question. Develop ideas across several varied, reasonably concise turns. Neither speaker is permanently the interviewer, teacher, expert, or student. Use natural B2-C1 spoken English.

Do not contradict the technical source or mention documents, prompts, exercises, lessons, or study material. Return structured turns with stable ids, zero-based sequence, section ids, delivery direction, and a duration estimate.

Technical source: ${JSON.stringify(content)}
Discussion plan: ${JSON.stringify(plan)}`;
}
