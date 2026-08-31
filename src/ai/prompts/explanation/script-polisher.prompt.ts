import { ExplanationConversationPlan, RawPodcastScript, StudyContent } from '../../../domain/models';
import { NOTION_POLISHER_PUBLISH_RULES } from '../../../persistence/notion-format.contract';
import { EXPLANATION_SPEAKER_POLICY } from './speaker-policy';

export const EXPLANATION_POLISHER_PROMPT_VERSION = 'script-polisher.explanation.v5';

export function buildExplanationPolisherPrompt(input: {
  article: StudyContent;
  plan: ExplanationConversationPlan;
  rawScript: RawPodcastScript;
}): string {
  return `Polish only the spoken delivery of this didactic lesson.

The article remains the canonical technical source. Preserve what must remain true, every source
articleSectionId, speaker mode, and conceptual sequence. You may shorten, merge repetitive phrasing,
improve transitions, and make sentences easier to hear. Do not add unsupported technical information,
turn instructor-only teaching into dialogue, change conceptual dependencies, or generate pause milliseconds.

Remove acknowledgment-only turns. A second speaker must contribute a question, misconception,
contrast, inference, alternative, or decision. If a turn merely agrees with or paraphrases the
previous turn, remove or merge it. If several examples demonstrate the same point, keep the strongest.
Preserve stable ids where retained and renumber sequence contiguously from zero.

${EXPLANATION_SPEAKER_POLICY}
${NOTION_POLISHER_PUBLISH_RULES}

CANONICAL ARTICLE: ${JSON.stringify(input.article)}
DELIVERY PLAN: ${JSON.stringify(input.plan)}
RAW SCRIPT: ${JSON.stringify(input.rawScript)}`;
}
