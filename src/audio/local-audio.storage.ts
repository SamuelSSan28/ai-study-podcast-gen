import { Injectable } from '@nestjs/common';
import path from 'node:path';
import { AudioStorage } from '../application/ports';
import { LocalAudioService } from './local-audio.service';

@Injectable()
export class LocalAudioStorage implements AudioStorage {
  constructor(private readonly localAudio: LocalAudioService) {}

  upload(input: { filePath: string; filename: string; folderPath: string[] }): Promise<{
    externalId: string;
    listenUrl: string;
    downloadUrl?: string;
  }> {
    const sessionId = path.basename(input.filePath, path.extname(input.filePath));
    const listenUrl = this.localAudio.publicUrl(sessionId);
    return Promise.resolve({
      externalId: sessionId,
      listenUrl,
      downloadUrl: listenUrl,
    });
  }
}
