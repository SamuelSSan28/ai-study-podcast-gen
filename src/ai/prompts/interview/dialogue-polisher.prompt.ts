import { RawPodcastScript } from '../../../domain/models';
import { NOTION_POLISHER_PUBLISH_RULES } from '../../../persistence/notion-format.contract';

export const INTERVIEW_POLISHER_PROMPT_VERSION = 'dialogue-polisher.interview.v4';

export function buildInterviewPolisherPrompt(script: RawPodcastScript): string {
  return `Polish this technically correct interview for natural spoken English. Preserve technical meaning, questions and challenges, constraint reveals, speaker identities, ids, sequence, and section ids. Improve concise candidate answers, natural follow-ups, reactions, pacing, contractions, and continuity. Reduce academic language, repeated confirmations, long monologues, and robotic Q&A. Do not introduce new technical facts. ${NOTION_POLISHER_PUBLISH_RULES} Return the complete structured script.\n${JSON.stringify(script)}`;
}
