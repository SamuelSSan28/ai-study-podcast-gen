import { RawPodcastScript } from '../../../domain/models';

export const DISCUSSION_POLISHER_PROMPT_VERSION = 'dialogue-polisher.discussion.v1';

export function buildDiscussionPolisherPrompt(script: RawPodcastScript): string {
  return `Polish this technically correct podcast so it sounds like two engineers genuinely discussing a system. Preserve technical meaning, architecture facts, scenario constraints, speaker identities, ids, sequence, and section ids. Improve reactions, continuity, natural agreement and disagreement, references to earlier decisions, contractions, varied turn length, and spoken rhythm. Reduce interview-like Q&A, disconnected statements, repeated acknowledgments, lectures, and written-English phrasing. Both speakers remain competent peers. Keep language B2-C1 and TTS-friendly. Do not introduce new technical facts. Return the complete structured script.\n${JSON.stringify(script)}`;
}
