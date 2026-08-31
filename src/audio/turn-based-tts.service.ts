import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { OpenAiGateway } from '../ai/openai.gateway';
import { TtsSegmentState } from '../domain/models';
import { AudioSegment } from './audio-composer';
import { TtsJob } from './audio-director';
@Injectable()
export class TurnBasedTtsService {
  constructor(
    private readonly ai: OpenAiGateway,
    private readonly config: ConfigService,
  ) {}
  async generate(
    episodeId: string,
    jobs: TtsJob[],
    prior: TtsSegmentState[] = [],
    onProgress?: (states: TtsSegmentState[]) => Promise<void>,
  ): Promise<{ segments: AudioSegment[]; states: TtsSegmentState[] }> {
    const directory = path.resolve(
      this.config.get<string>('AUDIO_STORAGE_PATH', './storage/podcasts'),
      '..',
      'tmp',
      episodeId,
    );
    await fs.mkdir(directory, { recursive: true });
    const states = [...prior];
    const segments: AudioSegment[] = [];
    for (const job of jobs) {
      const filename = `${String(job.sequence + 1).padStart(4, '0')}-${job.speaker.toLowerCase()}-t${job.turnSequence}c${job.chunkIndex}.mp3`;
      const destination = path.join(directory, filename);
      const previous = states.find((state) => state.sequence === job.sequence);
      if (previous?.status !== 'READY' || !(await this.exists(destination))) {
        const state = previous ?? {
          sequence: job.sequence,
          path: destination,
          status: 'PENDING' as const,
        };
        state.status = 'PENDING';
        state.lastError = undefined;
        if (!previous) states.push(state);
        try {
          await this.ai.generateSpeech(
            job.text,
            job.voice,
            job.instructions,
            destination,
            job.speed,
          );
          state.status = 'READY';
        } catch (error) {
          state.status = 'FAILED';
          state.lastError = error instanceof Error ? error.message : 'TTS failed';
          await onProgress?.(states);
          throw error;
        }
        await onProgress?.(states);
      }
      segments.push({ job, path: destination });
    }
    return { segments, states };
  }
  private async exists(file: string): Promise<boolean> {
    try {
      await fs.access(file);
      return true;
    } catch {
      return false;
    }
  }
}
