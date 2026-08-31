import { zodTextFormat } from 'openai/helpers/zod';
import { z } from 'zod';
import {
  contentSchema,
  discussionConversationPlanSchema,
  discussionScriptSchema,
  duplicateSchema,
  explanationConversationPlanSchema,
  explanationScriptSchema,
  generatedPlanSchema,
  interviewConversationPlanSchema,
  interviewScriptSchema,
  normalizedPlanInputSchema,
  topicResearchSchema,
} from '../src/ai/schemas';

const openAiSchemas = [
  ['study_plan', generatedPlanSchema],
  ['topic_research', topicResearchSchema],
  ['duplicate_validation', duplicateSchema],
  ['normalized_plan_input', normalizedPlanInputSchema],
  ['study_content', contentSchema],
  ['conversation_plan', interviewConversationPlanSchema],
  ['conversation_plan', discussionConversationPlanSchema],
  ['conversation_plan', explanationConversationPlanSchema],
  ['podcast_script', interviewScriptSchema],
  ['podcast_script', discussionScriptSchema],
  ['podcast_script', explanationScriptSchema],
] as const;

function collectBareOptionalPaths(schema: z.ZodTypeAny, path = '#'): string[] {
  if (schema instanceof z.ZodOptional && !(schema._def.innerType instanceof z.ZodNullable)) {
    return [path];
  }

  if (schema instanceof z.ZodDefault) {
    return collectBareOptionalPaths(schema._def.innerType, path);
  }

  if (schema instanceof z.ZodNullable) {
    return collectBareOptionalPaths(schema._def.innerType, path);
  }

  if (schema instanceof z.ZodObject) {
    return Object.entries(schema.shape).flatMap(([key, child]) =>
      collectBareOptionalPaths(child as z.ZodTypeAny, `${path}/properties/${key}`),
    );
  }

  if (schema instanceof z.ZodArray) {
    return collectBareOptionalPaths(schema._def.type, `${path}/items`);
  }

  if (schema instanceof z.ZodUnion) {
    return schema.options.flatMap((option: z.ZodTypeAny, index: number) =>
      collectBareOptionalPaths(option, `${path}/anyOf/${index}`),
    );
  }

  if (schema instanceof z.ZodDiscriminatedUnion) {
    return [...schema.options.values()].flatMap((option: z.ZodTypeAny, index: number) =>
      collectBareOptionalPaths(option, `${path}/anyOf/${index}`),
    );
  }

  if (schema instanceof z.ZodEffects) {
    return collectBareOptionalPaths(schema._def.schema, path);
  }

  return [];
}

describe('OpenAI structured output schemas', () => {
  it.each(openAiSchemas)('%s (%s) has no bare .optional() fields', (_name, schema) => {
    expect(collectBareOptionalPaths(schema)).toEqual([]);
  });

  it.each(openAiSchemas)('%s (%s) converts for zodTextFormat', (name, schema) => {
    expect(() => zodTextFormat(schema, name)).not.toThrow();
  });
});
