import { z } from 'zod';
import {
  ConversationPlan,
  CreateConversationPlanInput,
  PodcastMode,
  RawPodcastScript,
  StudyContent,
  StudyPlanTopic,
} from '../../domain/models';
import {
  discussionConversationPlanSchema,
  discussionScriptSchema,
  explanationConversationPlanSchema,
  explanationScriptSchema,
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
import {
  buildExplanationPlannerPrompt,
  EXPLANATION_PLANNER_PROMPT_VERSION,
} from './explanation/lesson-planner.prompt';
import {
  buildExplanationScriptPrompt,
  EXPLANATION_SCRIPT_PROMPT_VERSION,
} from './explanation/lesson-script.prompt';
import {
  buildExplanationPolisherPrompt,
  EXPLANATION_POLISHER_PROMPT_VERSION,
} from './explanation/script-polisher.prompt';

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
  value: { topic: StudyPlanTopic; content: StudyContent; plan: ConversationPlan };
}): ResolvedPrompt<RawPodcastScript>;
export function resolvePrompt(input: {
  stage: 'dialogue-polisher';
  mode: PodcastMode;
  value:
    | RawPodcastScript
    | { article: StudyContent; plan: ConversationPlan; rawScript: RawPodcastScript };
}): ResolvedPrompt<RawPodcastScript>;
export function resolvePrompt(input: {
  stage: PromptStage;
  mode: PodcastMode;
  value:
    | CreateConversationPlanInput
    | { topic: StudyPlanTopic; content: StudyContent; plan: ConversationPlan }
    | RawPodcastScript
    | { article: StudyContent; plan: ConversationPlan; rawScript: RawPodcastScript };
}): ResolvedPrompt<ConversationPlan | RawPodcastScript> {
  if (input.stage === 'conversation-plan') {
    const value = input.value as CreateConversationPlanInput;
    if (input.mode === 'INTERVIEW') {
      return {
        prompt: buildInterviewPlannerPrompt(value),
        version: INTERVIEW_PLANNER_PROMPT_VERSION,
        schema: interviewConversationPlanSchema,
      };
    }
    if (input.mode === 'EXPLANATION') {
      return {
        prompt: buildExplanationPlannerPrompt(value),
        version: EXPLANATION_PLANNER_PROMPT_VERSION,
        schema: explanationConversationPlanSchema,
      };
    }
    return {
      prompt: buildDiscussionPlannerPrompt(value),
      version: DISCUSSION_PLANNER_PROMPT_VERSION,
      schema: discussionConversationPlanSchema,
    };
  }
  if (input.stage === 'podcast-script') {
    const { topic, content, plan } = input.value as {
      topic: StudyPlanTopic;
      content: StudyContent;
      plan: ConversationPlan;
    };
    if (input.mode === 'INTERVIEW') {
      return {
        prompt: buildInterviewScriptPrompt(
          topic,
          content,
          plan as Extract<ConversationPlan, { mode: 'INTERVIEW' }>,
        ),
        version: INTERVIEW_SCRIPT_PROMPT_VERSION,
        schema: interviewScriptSchema,
      };
    }
    if (input.mode === 'EXPLANATION') {
      return {
        prompt: buildExplanationScriptPrompt(
          topic,
          content,
          plan as Extract<ConversationPlan, { mode: 'EXPLANATION' }>,
        ),
        version: EXPLANATION_SCRIPT_PROMPT_VERSION,
        schema: explanationScriptSchema,
      };
    }
    return {
      prompt: buildDiscussionScriptPrompt(
        topic,
        content,
        plan as Extract<ConversationPlan, { mode: 'DISCUSSION' }>,
      ),
      version: DISCUSSION_SCRIPT_PROMPT_VERSION,
      schema: discussionScriptSchema,
    };
  }
  const polishValue = input.value as
    | RawPodcastScript
    | { article: StudyContent; plan: ConversationPlan; rawScript: RawPodcastScript };
  const script = 'rawScript' in polishValue ? polishValue.rawScript : polishValue;
  if (input.mode === 'INTERVIEW') {
    return {
      prompt: buildInterviewPolisherPrompt(script),
      version: INTERVIEW_POLISHER_PROMPT_VERSION,
      schema: interviewScriptSchema,
    };
  }
  if (input.mode === 'EXPLANATION') {
    if (!('rawScript' in polishValue)) {
      throw new Error('Explanation polishing requires article and plan context');
    }
    return {
      prompt: buildExplanationPolisherPrompt({
        article: polishValue.article,
        plan: polishValue.plan as Extract<ConversationPlan, { mode: 'EXPLANATION' }>,
        rawScript: script,
      }),
      version: EXPLANATION_POLISHER_PROMPT_VERSION,
      schema: explanationScriptSchema,
    };
  }
  return {
    prompt: buildDiscussionPolisherPrompt(script),
    version: DISCUSSION_POLISHER_PROMPT_VERSION,
    schema: discussionScriptSchema,
  };
}
