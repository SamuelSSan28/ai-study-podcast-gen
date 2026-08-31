import { Injectable } from '@nestjs/common';
import { OpenAiGateway } from '../ai/openai.gateway';
import {
  ConversationPlan,
  PodcastMode,
  PodcastScript,
  RawPodcastScript,
  StudyContent,
} from '../domain/models';
export interface DialoguePolisher {
  polish(
    script: RawPodcastScript,
    mode: PodcastMode,
    context?: { article: StudyContent; plan: ConversationPlan },
  ): Promise<PodcastScript>;
}
@Injectable()
export class OpenAiDialoguePolisher implements DialoguePolisher {
  constructor(private readonly ai: OpenAiGateway) {}
  polish(
    script: RawPodcastScript,
    mode: PodcastMode,
    context?: { article: StudyContent; plan: ConversationPlan },
  ): Promise<PodcastScript> {
    return this.ai.polishDialogue(script, mode, context);
  }
}
