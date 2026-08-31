import { CreateConversationPlanInput } from '../../../domain/models';
import {
  formatPlannerSourceArticle,
  PLANNER_ARTICLE_FIDELITY,
} from '../scope-discipline';

export const DISCUSSION_PLANNER_PROMPT_VERSION = 'conversation-planner.discussion.v3';

export function buildDiscussionPlannerPrompt(input: CreateConversationPlanInput): string {
  return `Plan a natural ${input.targetMinutes}-minute technical discussion between two experienced software engineers.

This is not an interview. Both are peers collaboratively exploring the topic in the source article. Do not write dialogue. Structure the discussion around the concepts, examples, and progression in the article — do not invent adjacent architecture topics, production incidents, or tooling unless they appear in the article.

For each section define entryPoint, discussionGoal, conceptsToExplore, tensions, questionsToNaturallyRaise, scenarioReveals, possibleDisagreement, and connectionToPreviousSection. Set mode to DISCUSSION.

Rules:
- Keep focus on this topic's article content, not independent backend trivia.
- Do not force technologies absent from the article; both engineers discuss what the article teaches.
- Later sections should deepen article concepts, not introduce new ones.

${PLANNER_ARTICLE_FIDELITY}

${formatPlannerSourceArticle(input)}
Previous sessions (background only — do not expand scope): ${JSON.stringify(input.previousSessions ?? [])}
Study plan context (background only): ${JSON.stringify(input.studyPlanContext)}`;
}
