import { ExplanationConversationPlan, StudyContent, StudyPlanTopic } from '../../../domain/models';
import { NOTION_SCRIPT_RULES } from '../../../persistence/notion-format.contract';
import {
  formatScriptSourceContext,
  SCRIPT_TRANSFORM_RULES,
} from '../scope-discipline';
import {
  EXPLANATION_DELIVERY_HINTS,
  EXPLANATION_PEDAGOGICAL_RULES,
} from './pedagogical-rules';
import { EXPLANATION_SPEAKER_POLICY } from './speaker-policy';

export const EXPLANATION_SCRIPT_PROMPT_VERSION = 'lesson-script.explanation.v6';

const deliveryApproachContext: Record<ExplanationConversationPlan['deliveryApproach'], string> = {
  solo_lecture:
    'Episode is fully instructor-solo: every section must use INSTRUCTOR only. Never emit CO_HOST.',
  instructor_with_faq:
    'Instructor-led with selective dialogue: follow each section speakerMode. Foundations stay INSTRUCTOR-only; dialogue sections use CO_HOST only for real pedagogical tension.',
  guided_walkthrough:
    'Guided walkthrough of runningScenario: follow each section speakerMode. Practice/decision sections may use CO_HOST; definitional sections stay INSTRUCTOR-only.',
};

export function buildExplanationScriptPrompt(
  topic: StudyPlanTopic,
  content: StudyContent,
  plan: ExplanationConversationPlan,
): string {
  return `Transform this lesson plan into a didactic spoken script for audio delivery.

Central question for this episode: "${plan.centralQuestion}"
Running scenario: ${JSON.stringify(plan.runningScenario)}

Follow deliveryApproach "${plan.deliveryApproach}" (${plan.deliveryRationale}).
${deliveryApproachContext[plan.deliveryApproach]}

Respect each plan section's speakerMode for that sectionId:
- instructor_solo: emit INSTRUCTOR turns only. Direct, didactic spoken prose — no artificial dialogue, no second voice agreeing or paraphrasing.
- dialogue: use CO_HOST + INSTRUCTOR. CO_HOST opens with a real doubt, wrong assumption, or decision point tied to dialogueReason and coHostMoments. INSTRUCTOR advances the reasoning (e.g. a change of decision) — never mere agreement or paraphrase.

${EXPLANATION_SPEAKER_POLICY}

Map each plan section (episodeBeat) to script sectionIds. The script must follow the pedagogical arc in order.

${SCRIPT_TRANSFORM_RULES}

${EXPLANATION_PEDAGOGICAL_RULES}

${EXPLANATION_DELIVERY_HINTS}

Use natural spoken English suitable for TTS. Do not mention documents, prompts, exercises, or study materials. Return structured turns with stable ids, zero-based sequence, section ids, role, delivery direction, and duration estimate.

${NOTION_SCRIPT_RULES}

${formatScriptSourceContext(topic, content)}
Lesson plan: ${JSON.stringify(plan)}`;
}
