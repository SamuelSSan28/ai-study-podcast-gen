import { Injectable } from '@nestjs/common';
import { OpenAiGateway } from '../ai/openai.gateway';
import { ConversationPlan, RawPodcastScript, StudyContent } from '../domain/models';
export interface PodcastScriptGenerator {
  generate(input: {
    technicalContent: StudyContent;
    conversationPlan: ConversationPlan;
  }): Promise<RawPodcastScript>;
}
@Injectable()
export class OpenAiPodcastScriptGenerator implements PodcastScriptGenerator {
  constructor(private readonly ai: OpenAiGateway) {}
  generate(input: {
    technicalContent: StudyContent;
    conversationPlan: ConversationPlan;
  }): Promise<RawPodcastScript> {
    return this.ai.generateScript(input.technicalContent, input.conversationPlan);
  }
}
