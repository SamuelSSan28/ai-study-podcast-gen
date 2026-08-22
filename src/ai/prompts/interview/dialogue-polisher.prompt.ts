import { RawPodcastScript } from '../../../domain/models';

export const INTERVIEW_POLISHER_PROMPT_VERSION = 'dialogue-polisher.interview.v2';

export function buildInterviewPolisherPrompt(script: RawPodcastScript): string {
  return `Polish this technically correct interview for natural spoken English. Preserve technical meaning, questions and challenges, constraint reveals, speaker identities, ids, sequence, and section ids. Improve concise candidate answers, natural follow-ups, reactions, rhythm, contractions, and continuity. Reduce academic language, repeated acknowledgments, long monologues, and robotic Q&A. Keep the candidate at B2-C1 English. Do not introduce new technical facts. Return the complete structured script.\n${JSON.stringify(script)}`;
}
