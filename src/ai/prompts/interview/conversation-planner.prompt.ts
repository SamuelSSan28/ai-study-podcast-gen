import { CreateConversationPlanInput } from '../../../domain/models';

export const INTERVIEW_PLANNER_PROMPT_VERSION = 'conversation-planner.interview.v2';

export function buildInterviewPlannerPrompt(input: CreateConversationPlanInput): string {
  return `Plan a realistic ${input.targetMinutes}-minute senior backend engineering interview.

Do not write dialogue. The interviewer progressively explores one production system and challenges the candidate's decisions. Create a continuous progression: business context → requirements clarification → initial architecture → deeper technical decisions → new constraints → trade-offs → production incident → observability/reliability → final reflection.

For each section define initialQuestion, candidateExpectedReasoning, interviewerChallenges, conceptsToExplore, constraintsToReveal, and transitionHint. Set mode to INTERVIEW.

Rules:
- Stay focused on this project; do not create unrelated trivia questions.
- The candidate must not know every constraint upfront.
- Later information should sometimes force revision of an earlier decision.
- Include one realistic production incident without revealing its root cause.

Study plan context: ${JSON.stringify(input.studyPlanContext)}
Topic: ${JSON.stringify(input.topic)}
Technical source: ${JSON.stringify(input.technicalContent)}
Previous sessions (context only): ${JSON.stringify(input.previousSessions ?? [])}`;
}
