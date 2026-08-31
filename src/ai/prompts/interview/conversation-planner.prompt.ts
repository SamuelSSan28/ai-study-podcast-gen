import { CreateConversationPlanInput } from '../../../domain/models';
import {
  formatPlannerSourceArticle,
  PLANNER_ARTICLE_FIDELITY,
} from '../scope-discipline';

export const INTERVIEW_PLANNER_PROMPT_VERSION = 'conversation-planner.interview.v4';

export function buildInterviewPlannerPrompt(input: CreateConversationPlanInput): string {
  return `Plan a realistic ${input.targetMinutes}-minute technical interview for senior backend engineering.

Do not write dialogue. Structure the interview around the concepts, examples, and progression in the source article. The interviewer explores what the article teaches — do not invent adjacent architecture topics, production incidents, or tooling unless they appear in the article.

For each section define initialQuestion, candidateExpectedReasoning, interviewerChallenges, conceptsToExplore, constraintsToReveal, and transitionHint. Set mode to INTERVIEW.

Rules:
- Keep focus on this topic's article content; do not create disconnected trivia questions.
- Constraints and challenges must come from article concepts, not invented scenarios.
- Later sections should deepen article concepts, not introduce new ones.

${PLANNER_ARTICLE_FIDELITY}

${formatPlannerSourceArticle(input)}
Previous sessions (background only — do not expand scope): ${JSON.stringify(input.previousSessions ?? [])}
Study plan context (background only): ${JSON.stringify(input.studyPlanContext)}`;
}
