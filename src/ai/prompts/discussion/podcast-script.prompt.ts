import { DiscussionConversationPlan, StudyContent, StudyPlanTopic } from '../../../domain/models';
import { NOTION_SCRIPT_RULES } from '../../../persistence/notion-format.contract';
import {
  formatScriptSourceContext,
  SCRIPT_TRANSFORM_RULES,
} from '../scope-discipline';

export const DISCUSSION_SCRIPT_PROMPT_VERSION = 'podcast-script.discussion.v4';

export function buildDiscussionScriptPrompt(
  topic: StudyPlanTopic,
  content: StudyContent,
  plan: DiscussionConversationPlan,
): string {
  return `Transform this plan into a natural technical podcast conversation between ENGINEER_A and ENGINEER_B. They are competent peers.

Both introduce ideas, react to the previous turn, ask natural questions, challenge assumptions, complement reasoning, occasionally disagree, suggest alternatives, and revisit decisions as constraints appear. Avoid question → complete answer → next question. Develop ideas across several varied, reasonably concise turns. Neither speaker is permanently interviewer, teacher, expert, or student. Use natural spoken English suitable for TTS.

${SCRIPT_TRANSFORM_RULES}

Do not mention documents, prompts, exercises, lessons, or study material. Return structured turns with stable ids, zero-based sequence, section ids, delivery direction, and duration estimate.

${NOTION_SCRIPT_RULES}

${formatScriptSourceContext(topic, content)}
Discussion plan: ${JSON.stringify(plan)}`;
}
