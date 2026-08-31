import { RawPodcastScript } from '../../../domain/models';
import { NOTION_POLISHER_PUBLISH_RULES } from '../../../persistence/notion-format.contract';

export const DISCUSSION_POLISHER_PROMPT_VERSION = 'dialogue-polisher.discussion.v3';

export function buildDiscussionPolisherPrompt(script: RawPodcastScript): string {
  return `Polish this technically correct podcast so it sounds like two engineers genuinely discussing a system. Preserve technical meaning, architecture facts, scenario constraints, speaker identities, ids, sequence, and section ids. Improve natural reactions, continuity, agreement and disagreement, references to earlier decisions, contractions, turn length variation, and spoken pacing. Reduce interview-style Q&A, disconnected statements, repeated confirmations, lectures, and written-English phrasing. Both speakers remain competent peers. Keep language suitable for TTS. Do not introduce new technical facts. ${NOTION_POLISHER_PUBLISH_RULES} Return the complete structured script.\n${JSON.stringify(script)}`;
}
