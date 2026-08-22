import { CreateConversationPlanInput } from '../../../domain/models';

export const DISCUSSION_PLANNER_PROMPT_VERSION = 'conversation-planner.discussion.v1';

export function buildDiscussionPlannerPrompt(input: CreateConversationPlanInput): string {
  return `Plan a natural ${input.targetMinutes}-minute technical podcast discussion between two experienced software engineers.

This is not an interview. Both engineers are peers and collaboratively explore one production system. Do not write dialogue. Create one evolving discussion: business problem → initial architecture → trade-offs → new constraints → alternative approaches → architecture refinement → production incident → reliability/observability → final reflection.

For each section define entryPoint, discussionGoal, conceptsToExplore, tensions, questionsToNaturallyRaise, scenarioReveals, possibleDisagreement, and connectionToPreviousSection. Set mode to DISCUSSION.

Rules:
- Stay focused on this project, not independent backend questions.
- Do not force technologies; both engineers contribute meaningful ideas.
- Later constraints challenge earlier assumptions.
- Include one realistic production incident without revealing its root cause.

Study plan context: ${JSON.stringify(input.studyPlanContext)}
Topic: ${JSON.stringify(input.topic)}
Technical source: ${JSON.stringify(input.technicalContent)}
Previous sessions (context only): ${JSON.stringify(input.previousSessions ?? [])}`;
}
