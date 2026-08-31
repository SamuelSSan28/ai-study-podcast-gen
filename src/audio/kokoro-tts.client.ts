import { Injectable } from '@nestjs/common';
import { AiModelConfig } from '../config/ai-model.config';

@Injectable()
export class KokoroTtsClient {
  constructor(private readonly models: AiModelConfig) {}

  async synthesize(text: string, voice: string, speed?: number): Promise<Buffer> {
    const response = await fetch(`${this.models.kokoroBaseUrl}/audio/speech`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'kokoro',
        input: text,
        voice,
        response_format: 'mp3',
        speed: speed ?? this.models.kokoroSpeed,
      }),
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new Error(
        `Kokoro TTS failed (${response.status})${detail ? `: ${detail.slice(0, 200)}` : ''}`,
      );
    }
    return Buffer.from(await response.arrayBuffer());
  }
}
