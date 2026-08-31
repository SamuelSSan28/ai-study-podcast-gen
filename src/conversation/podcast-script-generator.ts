import { Injectable } from '@nestjs/common';
import { OpenAiGateway } from '../ai/openai.gateway';
import { ConversationPlan, PodcastMode, RawPodcastScript, StudyContent, StudyPlanTopic } from '../domain/models';
export interface PodcastScriptGenerator {
  generate(input: {
    topic: StudyPlanTopic;
    technicalContent: StudyContent;
    conversationPlan: ConversationPlan;
    mode: PodcastMode;
  }): Promise<RawPodcastScript>;
}
@Injectable()
export class OpenAiPodcastScriptGenerator implements PodcastScriptGenerator {
  constructor(private readonly ai: OpenAiGateway) {}
  generate(input: {
    topic: StudyPlanTopic;
    technicalContent: StudyContent;
    conversationPlan: ConversationPlan;
    mode: PodcastMode;
  }): Promise<RawPodcastScript> {
    return this.ai.generateScript(
      input.topic,
      input.technicalContent,
      input.conversationPlan,
      input.mode,
    );
  }
}
