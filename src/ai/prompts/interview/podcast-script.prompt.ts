import { InterviewConversationPlan, StudyContent, StudyPlanTopic } from '../../../domain/models';
import { NOTION_SCRIPT_RULES } from '../../../persistence/notion-format.contract';
import {
  formatScriptSourceContext,
  SCRIPT_TRANSFORM_RULES,
} from '../scope-discipline';

export const INTERVIEW_SCRIPT_PROMPT_VERSION = 'podcast-script.interview.v6';

export function buildInterviewScriptPrompt(
  topic: StudyPlanTopic,
  content: StudyContent,
  plan: InterviewConversationPlan,
): string {
  return `Transform this plan into a natural technical interview between INTERVIEWER and CANDIDATE.

The interviewer asks concise questions, challenges assumptions, reveals constraints progressively, and deepens the previous answer instead of merely approving. The candidate asks clarifying questions, thinks aloud, justifies trade-offs, and occasionally revises an earlier decision. Use natural spoken English, concise and clear.

${SCRIPT_TRANSFORM_RULES}

Avoid trivia, textbook answers, long monologues, immediate perfect answers, and references to prompts, lessons, documents, or study material. Return structured turns with stable ids, zero-based sequence, section ids, delivery direction, and duration estimate.

${NOTION_SCRIPT_RULES}

${formatScriptSourceContext(topic, content)}
Interview plan: ${JSON.stringify(plan)}`;
}
