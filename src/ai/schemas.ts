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
      level: z.enum(['FOUNDATION', 'CORE', 'INTERMEDIATE', 'ADVANCED', 'APPLIED']),
      estimatedMinutes: z.number().int().min(30).max(60),
      tags: z.array(z.string()),
      learningObjectives: z.array(z.string()),
      prerequisites: z.array(z.string()),
      depthDelta: z.string(),
      summary: z.string(),
    }),
  ),
});
export const topicResearchSchema = z.object({
  summary: z.string(),
  keyConcepts: z.array(z.string()),
  sources: z
    .array(
      z.object({
        title: z.string().min(1),
        url: z.string().min(1),
        publisher: z.string().nullable(),
        type: z.enum(['OFFICIAL_DOCUMENTATION', 'PAPER', 'ARTICLE', 'BOOK', 'OTHER']),
      }),
    )
    .min(1),
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
const scriptBaseSchema = z.object({
  id: z.string(),
  title: z.string(),
  version: z.string(),
  estimatedDurationSeconds: z.number().int().positive(),
  turns: z
    .array(
      z.object({
        id: z.string(),
        speaker: z.enum(['HOST', 'INTERVIEWER', 'CANDIDATE', 'ENGINEER_A', 'ENGINEER_B']),
        text: z.string().min(1),
        sectionId: z.string(),
        sequence: z.number().int().nonnegative(),
        delivery: z
          .object({
            tone: z
              .enum(['neutral', 'curious', 'skeptical', 'thoughtful', 'confident', 'concerned'])
              .nullable(),
            pace: z.enum(['slow', 'medium', 'fast']).nullable(),
            emphasis: z.array(z.string()).nullable(),
            pauseBeforeMs: z.number().int().nonnegative().nullable(),
            pauseAfterMs: z.number().int().nonnegative().nullable(),
          })
          .nullable(),
      }),
    )
    .min(4),
});
export const interviewScriptSchema = scriptBaseSchema.refine(
  ({ turns }) =>
    ['INTERVIEWER', 'CANDIDATE'].every((speaker) => turns.some((turn) => turn.speaker === speaker)),
  'Interview scripts require INTERVIEWER and CANDIDATE',
);
export const discussionScriptSchema = scriptBaseSchema.refine(
  ({ turns }) =>
    ['ENGINEER_A', 'ENGINEER_B'].every((speaker) => turns.some((turn) => turn.speaker === speaker)),
  'Discussion scripts require ENGINEER_A and ENGINEER_B',
);
const conversationPlanBaseSchema = z.object({
  version: z.string(),
  title: z.string(),
  context: z.object({
    companyType: z.string(),
    product: z.string(),
    initialProblem: z.string(),
    scale: z.array(z.string()),
  }),
  objectives: z.array(z.string()),
  incident: z
    .object({
      title: z.string(),
      symptoms: z.array(z.string()),
      constraints: z.array(z.string()),
      expectedInvestigation: z.array(z.string()),
      sectionId: z.string(),
    })
    .nullable(),
  closing: z.object({ finalQuestion: z.string(), expectedThemes: z.array(z.string()) }),
});
export const interviewConversationPlanSchema = conversationPlanBaseSchema.extend({
  mode: z.literal('INTERVIEW'),
  sections: z
    .array(
      z.object({
        id: z.string(),
        topic: z.string(),
        objective: z.string(),
        initialQuestion: z.string(),
        conceptsToExplore: z.array(z.string()),
        candidateExpectedReasoning: z.array(z.string()),
        interviewerChallenges: z.array(z.string()),
        constraintsToReveal: z.array(
          z.object({
            afterTurn: z.number().int().positive().nullable(),
            condition: z.string().nullable(),
            reveal: z.string(),
            expectedImpact: z.string(),
          }),
        ),
        transitionHint: z.string().nullable(),
      }),
    )
    .min(2),
});
export const discussionConversationPlanSchema = conversationPlanBaseSchema.extend({
  mode: z.literal('DISCUSSION'),
  sections: z
    .array(
      z.object({
        id: z.string(),
        topic: z.string(),
        objective: z.string(),
        entryPoint: z.string(),
        discussionGoal: z.string(),
        conceptsToExplore: z.array(z.string()),
        tensions: z.array(z.string()),
        questionsToNaturallyRaise: z.array(z.string()),
        scenarioReveals: z.array(
          z.object({
            afterTurn: z.number().int().positive().nullable(),
            condition: z.string().nullable(),
            reveal: z.string(),
            expectedImpact: z.string(),
          }),
        ),
        possibleDisagreement: z.string().nullable(),
        connectionToPreviousSection: z.string().nullable(),
      }),
    )
    .min(2),
});
