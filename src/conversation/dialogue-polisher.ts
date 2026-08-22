import { Injectable } from '@nestjs/common';
import { OpenAiGateway } from '../ai/openai.gateway';
import { PodcastScript, RawPodcastScript } from '../domain/models';
export interface DialoguePolisher {
  polish(script: RawPodcastScript): Promise<PodcastScript>;
}
@Injectable()
export class OpenAiDialoguePolisher implements DialoguePolisher {
  constructor(private readonly ai: OpenAiGateway) {}
  polish(script: RawPodcastScript): Promise<PodcastScript> {
    return this.ai.polishDialogue(script);
  }
}
