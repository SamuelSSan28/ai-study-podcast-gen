import { Injectable } from '@nestjs/common';
import { OpenAiGateway } from '../ai/openai.gateway';
import { ConversationPlan, CreateConversationPlanInput } from '../domain/models';
export interface ConversationPlanner {
  createPlan(input: CreateConversationPlanInput): Promise<ConversationPlan>;
}
@Injectable()
export class OpenAiConversationPlanner implements ConversationPlanner {
  constructor(private readonly ai: OpenAiGateway) {}
  createPlan(input: CreateConversationPlanInput): Promise<ConversationPlan> {
    return this.ai.createConversationPlan(input);
  }
}
