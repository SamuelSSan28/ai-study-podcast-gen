import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PodcastScript, PodcastSpeaker } from '../domain/models';
import {
  CADENCE,
  chunkSpeedMultiplier,
  jitterMs,
  resolveDeliveryStyle,
} from './cadence';
import { endsWithQuestion, segmentIntoChunks } from './speech-segmenter';

export interface TtsJob {
  sequence: number;
  turnSequence: number;
  chunkIndex: number;
  chunkCount: number;
  speaker: PodcastSpeaker;
  voice: string;
  text: string;
  instructions?: string;
  speed: number;
  pauseBeforeMs: number;
  pauseAfterMs: number;
}

export interface AudioDirector {
  buildJobs(script: PodcastScript): TtsJob[];
}

const VOICE_ALIASES: Partial<Record<PodcastSpeaker, string>> = {
  INSTRUCTOR: 'PODCAST_HOST_VOICE',
  CO_HOST: 'PODCAST_ENGINEER_B_VOICE',
  HOST: 'PODCAST_HOST_VOICE',
};

/**
 * Separates script content from audio delivery: turns stay intact in the script,
 * but TTS runs on small semantic chunks with FFmpeg-friendly silence between them.
 */
@Injectable()
export class PodcastAudioRenderer implements AudioDirector {
  constructor(private readonly config: ConfigService) {}

  buildJobs(script: PodcastScript): TtsJob[] {
    const jobs: TtsJob[] = [];
    let previousSpeaker: PodcastSpeaker | undefined;
    let globalSequence = 0;

    for (const turn of script.turns) {
      const delivery = turn.delivery;
      const style = resolveDeliveryStyle(delivery, turn.role, turn.speaker);
      const cadence = CADENCE[style];
      const chunks = segmentIntoChunks(turn.text, cadence.maxSentencesPerChunk);
      const speakerChanged = previousSpeaker !== undefined && previousSpeaker !== turn.speaker;
      previousSpeaker = turn.speaker;

      const baseSpeed = this.speedForSpeaker(turn.speaker);
      const voice = this.voiceForSpeaker(turn.speaker);

      chunks.forEach((chunkText, chunkIndex) => {
        const isFirst = chunkIndex === 0;
        const isLast = chunkIndex === chunks.length - 1;
        const seed = turn.sequence * 31 + chunkIndex * 17 + style.length;

        let pauseBeforeMs = 0;
        if (isFirst) {
          pauseBeforeMs =
            delivery?.pauseBeforeMs ??
            (speakerChanged ? jitterMs(cadence.speakerChangePause, seed) : 0);
        }

        let pauseAfterMs: number;
        if (!isLast) {
          const range =
            chunkIndex > 0 && chunks[chunkIndex - 1].length > 80
              ? cadence.paragraphPause
              : cadence.sentencePause;
          pauseAfterMs = jitterMs(range, seed + 1);
        } else if (endsWithQuestion(chunkText) && cadence.questionPauseAfter) {
          pauseAfterMs =
            delivery?.pauseAfterMs ?? jitterMs(cadence.questionPauseAfter, seed + 2);
        } else if (isLast && delivery?.pauseAfterMs != null) {
          pauseAfterMs = delivery.pauseAfterMs;
        } else {
          pauseAfterMs = jitterMs(cadence.paragraphPause, seed + 3);
        }

        const speed = chunkSpeedMultiplier(baseSpeed, cadence, seed + 4);
        const instructions = this.instructionsFor(turn.speaker, delivery, style);

        jobs.push({
          sequence: globalSequence++,
          turnSequence: turn.sequence,
          chunkIndex,
          chunkCount: chunks.length,
          speaker: turn.speaker,
          voice,
          text: chunkText,
          instructions,
          speed,
          pauseBeforeMs,
          pauseAfterMs,
        });
      });
    }

    return jobs;
  }

  private instructionsFor(
    speaker: PodcastSpeaker,
    delivery: PodcastScript['turns'][number]['delivery'],
    style: string,
  ): string | undefined {
    if (this.config.get<'kokoro' | 'openai'>('TTS_PROVIDER', 'kokoro') === 'kokoro') {
      return undefined;
    }
    const parts = [
      delivery?.tone && `Use a ${delivery.tone} tone.`,
      delivery?.pace && `Speak at a ${delivery.pace} pace.`,
      delivery?.emphasis?.length && `Subtly emphasize: ${delivery.emphasis.join(', ')}.`,
      `Delivery style: ${style}.`,
    ].filter(Boolean);
    return parts.length ? parts.join(' ') : undefined;
  }

  private speedForSpeaker(speaker: PodcastSpeaker): number {
    const base = this.config.get<number>('KOKORO_TTS_SPEED', 0.94);
    if (speaker === 'INSTRUCTOR' || speaker === 'HOST') {
      return this.config.get<number>('KOKORO_INSTRUCTOR_SPEED', 0.92);
    }
    if (speaker === 'CO_HOST') {
      return this.config.get<number>('KOKORO_CO_HOST_SPEED', 0.96);
    }
    return base;
  }

  private voiceForSpeaker(speaker: PodcastSpeaker): string {
    const direct = this.config.get<string>(`PODCAST_${speaker}_VOICE`);
    if (direct) return direct;
    const alias = VOICE_ALIASES[speaker];
    if (alias) return this.config.getOrThrow<string>(alias);
    return this.config.getOrThrow<string>(`PODCAST_${speaker}_VOICE`);
  }
}

/** @deprecated Use PodcastAudioRenderer — kept as alias for existing DI bindings. */
export const ConfigurableAudioDirector = PodcastAudioRenderer;
