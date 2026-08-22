import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PodcastScript, PodcastSpeaker } from '../domain/models';
export interface TtsJob {
  sequence: number;
  speaker: PodcastSpeaker;
  voice: string;
  text: string;
  instructions?: string;
  pauseBeforeMs: number;
  pauseAfterMs: number;
}
export interface AudioDirector {
  buildJobs(script: PodcastScript): TtsJob[];
}
@Injectable()
export class ConfigurableAudioDirector implements AudioDirector {
  constructor(private readonly config: ConfigService) {}
  buildJobs(script: PodcastScript): TtsJob[] {
    return script.turns.map((turn) => {
      const delivery = turn.delivery;
      const parts = [
        delivery?.tone && `Use a ${delivery.tone} tone.`,
        delivery?.pace && `Speak at a ${delivery.pace} pace.`,
        delivery?.emphasis?.length && `Subtly emphasize: ${delivery.emphasis.join(', ')}.`,
      ].filter(Boolean);
      return {
        sequence: turn.sequence,
        speaker: turn.speaker,
        voice: this.config.getOrThrow<string>(`PODCAST_${turn.speaker}_VOICE`),
        text: turn.text,
        instructions: parts.length ? parts.join(' ') : undefined,
        pauseBeforeMs: delivery?.pauseBeforeMs ?? 0,
        pauseAfterMs: delivery?.pauseAfterMs ?? 250,
      };
    });
  }
}
