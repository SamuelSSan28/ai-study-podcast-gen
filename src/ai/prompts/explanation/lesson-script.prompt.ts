import { ExplanationConversationPlan, StudyContent, StudyPlanTopic } from '../../../domain/models';
import { NOTION_SCRIPT_RULES } from '../../../persistence/notion-format.contract';
import { formatScriptSourceContext, SCRIPT_TRANSFORM_RULES } from '../scope-discipline';
import { EXPLANATION_DELIVERY_HINTS, EXPLANATION_PEDAGOGICAL_RULES } from './pedagogical-rules';
import { EXPLANATION_SPEAKER_POLICY } from './speaker-policy';

export const EXPLANATION_SCRIPT_PROMPT_VERSION = 'lesson-script.explanation.v8';

export function buildExplanationScriptPrompt(
  topic: StudyPlanTopic,
  content: StudyContent,
  plan: ExplanationConversationPlan,
): string {
  return `Transform the canonical article into a natural spoken lesson. The article is technical
truth; the plan contains delivery instructions only. TRANSFORM, DO NOT EXPAND.

Follow article order and use each plan articleSectionId as the sectionId for its script turns.
Respect speakerMode: instructor_solo emits INSTRUCTOR only; dialogue uses CO_HOST only to contribute
a question, misconception, contrast, inference, alternative, or decision grounded in dialogueReason.
Never add agreement-only or paraphrase-only turns.

You may simplify, shorten, make sentences spoken-friendly, add transitions or reflection questions,
recap, and turn an existing reasoning point into dialogue. You may not introduce another library,
a new technical example or concept, architecture advice, future curriculum, or invented claims.

${EXPLANATION_SPEAKER_POLICY}
${EXPLANATION_PEDAGOGICAL_RULES}
${SCRIPT_TRANSFORM_RULES}
${EXPLANATION_DELIVERY_HINTS}

Use each section's listenerQuestion, takeaway, and transitionFromPrevious as spoken shape only.
Open from transitionFromPrevious when it is present. Land on the takeaway before leaving the section.
If a cue is missing, do not invent facts to fill it.

Return stable turn ids, zero-based contiguous sequence, article section ids, speaker, role, optional
semantic delivery style, and duration estimate. Do not generate pause milliseconds or pace metadata.
${NOTION_SCRIPT_RULES}
${formatScriptSourceContext(topic, content)}
DELIVERY PLAN: ${JSON.stringify(plan)}`;
}
