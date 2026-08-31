import { DeliveryDirection, DialogueRole, PodcastSpeaker } from '../domain/models';

export type DeliveryStyle =
  | 'normal'
  | 'reflective'
  | 'conversational'
  | 'energetic'
  | 'question';

export interface CadencePreset {
  maxSentencesPerChunk: number;
  sentencePause: readonly [number, number];
  paragraphPause: readonly [number, number];
  speakerChangePause: readonly [number, number];
  speedMultiplier: number;
  questionPauseAfter?: readonly [number, number];
}

export const CONCEPT_TRANSITION_PAUSE = [700, 1000] as const;

export const CADENCE: Record<DeliveryStyle, CadencePreset> = {
  normal: {
    maxSentencesPerChunk: 2,
    sentencePause: [180, 260],
    paragraphPause: [350, 500],
    speakerChangePause: [300, 450],
    speedMultiplier: 1,
  },
  reflective: {
    maxSentencesPerChunk: 1,
    sentencePause: [280, 420],
    paragraphPause: [500, 750],
    speakerChangePause: [400, 600],
    speedMultiplier: 0.96,
  },
  conversational: {
    maxSentencesPerChunk: 2,
    sentencePause: [140, 220],
    paragraphPause: [280, 400],
    speakerChangePause: [250, 380],
    speedMultiplier: 1.02,
  },
  energetic: {
    maxSentencesPerChunk: 3,
    sentencePause: [120, 200],
    paragraphPause: [250, 350],
    speakerChangePause: [200, 320],
    speedMultiplier: 1.04,
  },
  question: {
    maxSentencesPerChunk: 1,
    sentencePause: [200, 300],
    paragraphPause: [400, 550],
    speakerChangePause: [350, 500],
    speedMultiplier: 0.98,
    questionPauseAfter: [450, 700],
  },
};

const ROLE_STYLE: Partial<Record<DialogueRole, DeliveryStyle>> = {
  HOOK: 'reflective',
  QUESTION: 'question',
  EXPLAIN: 'normal',
  EXAMPLE: 'normal',
  CHALLENGE: 'question',
  ANSWER: 'conversational',
  CORRECTION: 'normal',
  RECAP: 'reflective',
  TRANSITION: 'normal',
};

/** Deterministic pseudo-random pause in range — reproducible across re-renders. */
export function jitterMs(range: readonly [number, number], seed: number): number {
  const [min, max] = range;
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  const t = x - Math.floor(x);
  return Math.round(min + t * (max - min));
}

export function resolveDeliveryStyle(
  delivery: DeliveryDirection | null | undefined,
  role: DialogueRole | null | undefined,
  speaker: PodcastSpeaker,
): DeliveryStyle {
  if (delivery?.style) return delivery.style;
  if (role && ROLE_STYLE[role]) return ROLE_STYLE[role]!;
  if (speaker === 'CO_HOST') return 'conversational';
  return 'normal';
}

export function chunkSpeedMultiplier(
  baseSpeed: number,
  preset: CadencePreset,
  seed: number,
): number {
  const wobble = jitterMs([96, 104], seed) / 100;
  return Math.round(baseSpeed * preset.speedMultiplier * wobble * 1000) / 1000;
}
