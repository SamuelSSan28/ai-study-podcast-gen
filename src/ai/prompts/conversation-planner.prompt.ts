import { CreateConversationPlanInput } from '../../domain/models';
export const CONVERSATION_PLANNER_PROMPT_VERSION = 'conversation-planner.v1';
export function buildConversationPlannerPrompt(input: CreateConversationPlanInput): string {
  return `Given the technical system design below, create the structure for a natural ${input.targetMinutes}-minute senior backend engineering conversation.
Do not generate dialogue. Create one continuous progression: opening context, first architecture decision, follow-up questions, later constraint reveals, trade-offs, one realistic production incident, transitions, and final architecture review. The interviewer challenges assumptions rather than approving every answer. Avoid repetitive questions and unrelated backend topics. Everything must be grounded in this project. Constraints must change or test earlier reasoning.
Study plan context: ${JSON.stringify(input.studyPlanContext)}
Current topic: ${JSON.stringify(input.topic)}
Technical content: ${JSON.stringify(input.technicalContent)}
Previous sessions (context only, do not change topic): ${JSON.stringify(input.previousSessions ?? [])}`;
}
