import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { promises as fs } from 'node:fs';
import path from 'node:path';
@Injectable()
export class LocalAudioService {
  constructor(private readonly config: ConfigService) {}
  destination(sessionId: string): string {
    return path.resolve(this.config.getOrThrow<string>('AUDIO_STORAGE_PATH'), `${sessionId}.mp3`);
  }
  publicUrl(sessionId: string): string {
    return `${this.config.getOrThrow<string>('AUDIO_PUBLIC_BASE_URL').replace(/\/$/, '')}/${sessionId}`;
  }
  async save(destination: string, chunks: Buffer[]): Promise<void> {
    await fs.mkdir(path.dirname(destination), { recursive: true });
    const temporary = `${destination}.tmp`;
    await fs.writeFile(temporary, Buffer.concat(chunks));
    await fs.rename(temporary, destination);
  }
}
