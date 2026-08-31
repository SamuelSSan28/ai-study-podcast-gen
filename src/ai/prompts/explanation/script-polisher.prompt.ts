import { RawPodcastScript } from '../../../domain/models';
import { NOTION_POLISHER_PUBLISH_RULES } from '../../../persistence/notion-format.contract';
import {
  EXPLANATION_DELIVERY_HINTS,
  EXPLANATION_PEDAGOGICAL_RULES,
} from './pedagogical-rules';
import { EXPLANATION_SPEAKER_POLICY } from './speaker-policy';

export const EXPLANATION_POLISHER_PROMPT_VERSION = 'script-polisher.explanation.v4';

export function buildExplanationPolisherPrompt(script: RawPodcastScript): string {
  return `Polish this didactic lesson script so it sounds natural when spoken aloud in English.

Preserve technical meaning, section coverage, speaker identities (INSTRUCTOR, optional CO_HOST), turn ids, roles, sequence, and running-scenario continuity.

${EXPLANATION_SPEAKER_POLICY}

Do not add CO_HOST turns to sections that are currently instructor-only.
Do not convert solo foundational explanations into dialogue.
Do not insert a second speaker merely to agree with or paraphrase the instructor.

Improve:
- Spoken rhythm: break dense sentences into short TTS-friendly phrases.
- Progressive discovery: concepts should emerge from problems, not precede them.
- Where CO_HOST already appears: make questions and mistakes feel real, not FAQ-shaped.
- Pauses: set delivery.pauseAfterMs on questions, challenges, and answer reveals.

Do not add new concepts beyond the script. Do not convert the lesson into a debate or interview.

${EXPLANATION_PEDAGOGICAL_RULES}

${EXPLANATION_DELIVERY_HINTS}

${NOTION_POLISHER_PUBLISH_RULES}

Script: ${JSON.stringify(script)}`;
}
