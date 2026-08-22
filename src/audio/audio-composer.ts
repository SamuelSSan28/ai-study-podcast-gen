import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { TtsJob } from './audio-director';
export interface AudioSegment {
  job: TtsJob;
  path: string;
}
export interface AudioComposer {
  compose(segments: AudioSegment[], destination: string): Promise<void>;
}
@Injectable()
export class FfmpegAudioComposer implements AudioComposer {
  constructor(private readonly config: ConfigService) {}
  async compose(segments: AudioSegment[], destination: string): Promise<void> {
    if (!segments.length) throw new Error('Cannot compose an empty episode');
    const ordered = [...segments].sort((a, b) => a.job.sequence - b.job.sequence);
    await fs.mkdir(path.dirname(destination), { recursive: true });
    const inputs: string[] = [];
    const filters: string[] = [];
    const labels: string[] = [];
    ordered.forEach((segment, index) => {
      inputs.push('-i', segment.path);
      const before = segment.job.pauseBeforeMs;
      const after = segment.job.pauseAfterMs;
      filters.push(
        `[${index}:a]adelay=${before}|${before},apad=pad_dur=${after / 1000}[a${index}]`,
      );
      labels.push(`[a${index}]`);
    });
    filters.push(`${labels.join('')}concat=n=${ordered.length}:v=0:a=1[out]`);
    await this.run([
      '-y',
      ...inputs,
      '-filter_complex',
      filters.join(';'),
      '-map',
      '[out]',
      '-codec:a',
      'libmp3lame',
      '-q:a',
      '2',
      destination,
    ]);
  }
  private run(args: string[]): Promise<void> {
    return new Promise((resolve, reject) => {
      const process = spawn(this.config.get<string>('FFMPEG_PATH', 'ffmpeg'), args, {
        stdio: ['ignore', 'ignore', 'pipe'],
      });
      let stderr = '';
      process.stderr.on('data', (chunk: Buffer) => {
        stderr += chunk.toString();
      });
      process.on('error', reject);
      process.on('close', (code) =>
        code === 0
          ? resolve()
          : reject(new Error(`FFmpeg failed (${code}): ${stderr.slice(-1000)}`)),
      );
    });
  }
}
