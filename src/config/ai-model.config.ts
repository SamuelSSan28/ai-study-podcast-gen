import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AiModelConfig {
  constructor(private readonly config: ConfigService) {}
  get planning(): string {
    return this.config.getOrThrow<string>('OPENAI_PLANNING_MODEL');
  }
  get content(): string {
    return this.config.getOrThrow<string>('OPENAI_CONTENT_MODEL');
  }
  get validation(): string {
    return this.config.getOrThrow<string>('OPENAI_VALIDATION_MODEL');
  }
  get podcast(): string {
    return this.content;
  }
  get tts(): string {
    return this.config.getOrThrow<string>('OPENAI_TTS_MODEL');
  }
}
