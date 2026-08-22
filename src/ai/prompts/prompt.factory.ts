import { z } from 'zod';
import {
  ConversationPlan,
  CreateConversationPlanInput,
  PodcastMode,
  RawPodcastScript,
  StudyContent,
} from '../../domain/models';
import {
  discussionConversationPlanSchema,
  discussionScriptSchema,
  interviewConversationPlanSchema,
  interviewScriptSchema,
} from '../schemas';
import {
  buildInterviewPlannerPrompt,
  INTERVIEW_PLANNER_PROMPT_VERSION,
} from './interview/conversation-planner.prompt';
import {
  buildInterviewScriptPrompt,
  INTERVIEW_SCRIPT_PROMPT_VERSION,
} from './interview/podcast-script.prompt';
import {
  buildInterviewPolisherPrompt,
  INTERVIEW_POLISHER_PROMPT_VERSION,
} from './interview/dialogue-polisher.prompt';
import {
  buildDiscussionPlannerPrompt,
  DISCUSSION_PLANNER_PROMPT_VERSION,
} from './discussion/conversation-planner.prompt';
import {
  buildDiscussionScriptPrompt,
  DISCUSSION_SCRIPT_PROMPT_VERSION,
} from './discussion/podcast-script.prompt';
import {
  buildDiscussionPolisherPrompt,
  DISCUSSION_POLISHER_PROMPT_VERSION,
} from './discussion/dialogue-polisher.prompt';

type PromptStage = 'conversation-plan' | 'podcast-script' | 'dialogue-polisher';

export interface ResolvedPrompt<T> {
  prompt: string;
  version: string;
  schema: z.ZodType<T>;
}

export function resolvePrompt(input: {
  stage: 'conversation-plan';
  mode: PodcastMode;
  value: CreateConversationPlanInput;
}): ResolvedPrompt<ConversationPlan>;
export function resolvePrompt(input: {
  stage: 'podcast-script';
  mode: PodcastMode;
  value: { content: StudyContent; plan: ConversationPlan };
}): ResolvedPrompt<RawPodcastScript>;
export function resolvePrompt(input: {
  stage: 'dialogue-polisher';
  mode: PodcastMode;
  value: RawPodcastScript;
}): ResolvedPrompt<RawPodcastScript>;
export function resolvePrompt(input: {
  stage: PromptStage;
  mode: PodcastMode;
  value:
    | CreateConversationPlanInput
    | { content: StudyContent; plan: ConversationPlan }
    | RawPodcastScript;
}): ResolvedPrompt<ConversationPlan | RawPodcastScript> {
  if (input.stage === 'conversation-plan') {
    const value = input.value as CreateConversationPlanInput;
    return input.mode === 'INTERVIEW'
      ? {
          prompt: buildInterviewPlannerPrompt(value),
          version: INTERVIEW_PLANNER_PROMPT_VERSION,
          schema: interviewConversationPlanSchema,
        }
      : {
          prompt: buildDiscussionPlannerPrompt(value),
          version: DISCUSSION_PLANNER_PROMPT_VERSION,
          schema: discussionConversationPlanSchema,
        };
  }
  if (input.stage === 'podcast-script') {
    const { content, plan } = input.value as { content: StudyContent; plan: ConversationPlan };
    return input.mode === 'INTERVIEW'
      ? {
          prompt: buildInterviewScriptPrompt(
            content,
            plan as Extract<ConversationPlan, { mode: 'INTERVIEW' }>,
          ),
          version: INTERVIEW_SCRIPT_PROMPT_VERSION,
          schema: interviewScriptSchema,
        }
      : {
          prompt: buildDiscussionScriptPrompt(
            content,
            plan as Extract<ConversationPlan, { mode: 'DISCUSSION' }>,
          ),
          version: DISCUSSION_SCRIPT_PROMPT_VERSION,
          schema: discussionScriptSchema,
        };
  }
  const script = input.value as RawPodcastScript;
  return input.mode === 'INTERVIEW'
    ? {
        prompt: buildInterviewPolisherPrompt(script),
        version: INTERVIEW_POLISHER_PROMPT_VERSION,
        schema: interviewScriptSchema,
      }
    : {
        prompt: buildDiscussionPolisherPrompt(script),
        version: DISCUSSION_POLISHER_PROMPT_VERSION,
        schema: discussionScriptSchema,
      };
}
