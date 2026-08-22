import { z } from 'zod';
export const generatedPlanSchema = z.object({
  overview: z.string(),
  topics: z.array(
    z.object({
      title: z.string(),
      description: z.string(),
      week: z.number().int(),
      sequence: z.number().int(),
      difficulty: z.enum(['FOUNDATIONAL', 'INTERMEDIATE', 'ADVANCED']),
      tags: z.array(z.string()),
      learningObjectives: z.array(z.string()),
      prerequisites: z.array(z.string()),
      depthDelta: z.string(),
      summary: z.string(),
    }),
  ),
});
export const duplicateSchema = z.object({
  classification: z.enum(['NEW', 'RELATED_BUT_DEEPER', 'DUPLICATE']),
  rationale: z.string(),
});
export const contentSchema = z.object({
  overview: z.string(),
  businessContext: z.string(),
  requirements: z.array(z.string()),
  assumptions: z.array(z.string()),
  architecture: z.string(),
  architectureEvolution: z.array(z.string()),
  decisions: z.array(z.string()),
  failureScenarios: z.array(z.string()),
  observability: z.array(z.string()),
  slos: z.array(z.string()),
  tradeoffs: z.array(z.string()),
  vocabulary: z.array(z.string()),
  reviewQuestions: z.array(z.string()),
  challenge: z.string().nullable(),
});
export const scriptSchema = z.object({
  turns: z
    .array(
      z.object({ speaker: z.enum(['HOST', 'INTERVIEWER', 'CANDIDATE']), text: z.string().min(1) }),
    )
    .min(4),
});
