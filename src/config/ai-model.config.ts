import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AiModelConfig {
  constructor(private readonly config: ConfigService) {}

  /** Roadmap / study-plan generation (gpt-5.6-terra). */
  get roadmap(): string {
    return this.config.getOrThrow<string>('ROADMAP_MODEL');
  }

  /** Article, web research, and structured content (gpt-5.6-terra). */
  get article(): string {
    return this.config.getOrThrow<string>('ARTICLE_MODEL');
  }

  /** Podcast script pipeline: conversation plan, script, polish (gpt-5.6-terra). */
  get script(): string {
    return this.config.getOrThrow<string>('SCRIPT_MODEL');
  }

  /** Small tasks: goal normalization, duplicate classification (gpt-5.6-luna). */
  get aux(): string {
    return this.config.getOrThrow<string>('AUX_MODEL');
  }

  /** Used after two failures on the primary model. */
  get fallback(): string {
    return this.config.getOrThrow<string>('FALLBACK_MODEL');
  }

  get ttsProvider(): 'kokoro' | 'openai' {
    return this.config.getOrThrow<'kokoro' | 'openai'>('TTS_PROVIDER');
  }

  get openAiTtsModel(): string {
    return this.config.getOrThrow<string>('OPENAI_TTS_MODEL');
  }

  get kokoroBaseUrl(): string {
    return this.config.getOrThrow<string>('KOKORO_BASE_URL');
  }

  get kokoroSpeed(): number {
    return this.config.getOrThrow<number>('KOKORO_TTS_SPEED');
  }

  /** @deprecated Use {@link roadmap} */
  get planning(): string {
    return this.roadmap;
  }

  /** @deprecated Use {@link article} */
  get content(): string {
    return this.article;
  }

  /** @deprecated Use {@link aux} */
  get validation(): string {
    return this.aux;
  }

  /** @deprecated Use {@link script} */
  get podcast(): string {
    return this.script;
  }

  /** @deprecated Use {@link script} */
  get conversationPlan(): string {
    return this.script;
  }

  /** @deprecated Use {@link script} */
  get polish(): string {
    return this.script;
  }

  /** @deprecated Use {@link openAiTtsModel} when TTS_PROVIDER=openai */
  get tts(): string {
    return this.openAiTtsModel;
  }
}
