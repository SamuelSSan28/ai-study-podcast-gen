import { RawPodcastScript } from '../../domain/models';
export const DIALOGUE_POLISHER_PROMPT_VERSION = 'dialogue-polisher.v1';
export function buildDialoguePolisherPrompt(script: RawPodcastScript): string {
  return `Polish this already-correct dialogue for natural speech. Preserve technical meaning, speaker identity, ids, sequence, section coverage, interviewer challenges, constraint reveals, and architecture facts. Never introduce a new architectural fact. Shorten oversized monologues, vary turn length, improve reactions, transitions, rhythm and follow-up phrasing, and remove repetition and written-English phrasing. Candidate English must stay B2-C1; interviewer English may be naturally fluent. Short acknowledgments such as "Right", "Okay", or "Let me push on that" are allowed but must not be overused. Avoid filler and theatrical delivery. Return the complete structured script.\n${JSON.stringify(script)}`;
}
