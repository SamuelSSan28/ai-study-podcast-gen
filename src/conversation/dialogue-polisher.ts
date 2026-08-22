import { Injectable } from '@nestjs/common';
import { OpenAiGateway } from '../ai/openai.gateway';
import { PodcastMode, PodcastScript, RawPodcastScript } from '../domain/models';
export interface DialoguePolisher {
  polish(script: RawPodcastScript, mode: PodcastMode): Promise<PodcastScript>;
}
@Injectable()
export class OpenAiDialoguePolisher implements DialoguePolisher {
  constructor(private readonly ai: OpenAiGateway) {}
  polish(script: RawPodcastScript, mode: PodcastMode): Promise<PodcastScript> {
    return this.ai.polishDialogue(script, mode);
  }
}
