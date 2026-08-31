import { z } from 'zod';

/** OpenAI structured outputs require every field in the schema; use .nullable() instead of .optional(). */
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
export const normalizedPlanInputSchema = z.object({
  title: z.string().min(1),
  goal: z.string().min(1),
});
export const articleContentBlockSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('paragraph'), text: z.string(), italic: z.boolean() }),
  z.object({
    type: z.literal('heading'),
    level: z.union([z.literal(2), z.literal(3)]),
    text: z.string(),
  }),
  z.object({ type: z.literal('bullet_list'), items: z.array(z.string()) }),
  z.object({ type: z.literal('numbered_list'), items: z.array(z.string()) }),
  z.object({ type: z.literal('quote'), text: z.string() }),
  z.object({
    type: z.literal('callout'),
    variant: z.enum(['insight', 'warning', 'rule', 'remember']),
    text: z.string(),
  }),
  z.object({ type: z.literal('code'), language: z.string(), code: z.string() }),
  z.object({ type: z.literal('divider') }),
  z.object({
    type: z.literal('table'),
    headers: z.array(z.string()),
    rows: z.array(z.array(z.string())),
  }),
]);

export const contentSchema = z.object({
  sections: z
    .array(
      z.object({
        id: z.string(),
        title: z.string(),
        blocks: z.array(articleContentBlockSchema).min(1),
      }),
    )
    .min(1),
  reviewQuestions: z.array(z.string()).nullable(),
});
export const articleReviewSchema = z.object({
  approved: z.boolean(),
  issues: z.array(
    z.object({
      sectionId: z.string().nullable(),
      type: z.enum([
        'scope',
        'progression',
        'coverage',
        'clarity',
        'repetition',
        'example_overuse',
      ]),
      instruction: z.string().min(1),
    }),
  ),
});
export const articleLessonPlanSchema = z.object({
  lessonGoal: z.string().min(1),
  centralQuestion: z.string().min(1),
  progression: z
    .array(
      z.object({
        id: z.string().min(1),
        title: z.string().min(1),
        teachingGoal: z.string().min(1),
        dependsOn: z.array(z.string()),
        introduces: z.array(z.string()).min(1),
        boundaries: z.array(z.string()),
      }),
    )
    .min(2),
});
export const articleGenerationStateSchema = z.object({
  centralQuestion: z.string(),
  conceptsEstablished: z.array(z.string()),
  terminologyEstablished: z.array(z.object({ term: z.string(), meaning: z.string() })),
  examplesAlreadyUsed: z.array(z.string()),
  previousSectionSummary: z.string(),
});
export const articleSectionGenerationSchema = z.object({
  section: z.object({
    id: z.string(),
    title: z.string(),
    blocks: z.array(articleContentBlockSchema).min(1),
  }),
  state: articleGenerationStateSchema,
});
export const sectionReviewSchema = z.object({
  approved: z.boolean(),
  issues: z.array(
    z.object({
      type: z.enum(['scope', 'future_scope', 'clarity', 'boundary', 'repetition', 'progression']),
      instruction: z.string().min(1),
    }),
  ),
});
const dialogueRoleSchema = z.enum([
  'HOOK',
  'QUESTION',
  'EXPLAIN',
  'EXAMPLE',
  'CHALLENGE',
  'ANSWER',
  'CORRECTION',
  'RECAP',
  'TRANSITION',
]);
const deliverySchema = z
  .object({
    style: z.enum(['normal', 'reflective', 'conversational', 'energetic', 'question']).nullable(),
    tone: z
      .enum(['neutral', 'curious', 'skeptical', 'thoughtful', 'confident', 'concerned'])
      .nullable(),
    pace: z.enum(['slow', 'medium', 'fast']).nullable(),
    emphasis: z.array(z.string()).nullable(),
    pauseBeforeMs: z.number().int().nonnegative().nullable(),
    pauseAfterMs: z.number().int().nonnegative().nullable(),
  })
  .nullable();
const scriptBaseSchema = z.object({
  id: z.string(),
  title: z.string(),
  version: z.string(),
  estimatedDurationSeconds: z.number().int().positive(),
  turns: z
    .array(
      z.object({
        id: z.string(),
        speaker: z.enum([
          'HOST',
          'INTERVIEWER',
          'CANDIDATE',
          'ENGINEER_A',
          'ENGINEER_B',
          'INSTRUCTOR',
          'CO_HOST',
        ]),
        text: z.string().min(1),
        sectionId: z.string(),
        sequence: z.number().int().nonnegative(),
        role: dialogueRoleSchema.nullable(),
        delivery: deliverySchema,
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
const explanationDialogueReasonSchema = z.enum([
  'comparison',
  'tradeoff',
  'misconception',
  'decision',
]);
const explanationSectionSchema = z
  .object({
    articleSectionId: z.string(),
    purpose: z.string(),
    speakerMode: z.enum(['instructor_solo', 'dialogue']),
    dialogueReason: explanationDialogueReasonSchema.nullable(),
    dialoguePrompt: z.string().nullable(),
    recap: z.boolean(),
  })
  .superRefine((section, ctx) => {
    if (section.speakerMode === 'dialogue' && !section.dialogueReason) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'dialogueReason is required when speakerMode is dialogue',
        path: ['dialogueReason'],
      });
    }
    if (section.speakerMode === 'dialogue' && !section.dialoguePrompt) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'dialoguePrompt is required when speakerMode is dialogue',
        path: ['dialoguePrompt'],
      });
    }
    if (section.speakerMode === 'instructor_solo' && section.dialogueReason !== null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'dialogueReason must be null when speakerMode is instructor_solo',
        path: ['dialogueReason'],
      });
    }
    if (section.speakerMode === 'instructor_solo' && section.dialoguePrompt !== null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'dialoguePrompt must be null when speakerMode is instructor_solo',
        path: ['dialoguePrompt'],
      });
    }
  });
export const explanationConversationPlanSchema = z.object({
  mode: z.literal('EXPLANATION'),
  version: z.string(),
  title: z.string(),
  sections: z.array(explanationSectionSchema).min(1),
});
const explanationTurnSchema = z.object({
  id: z.string(),
  speaker: z.enum(['HOST', 'INSTRUCTOR', 'CO_HOST']),
  text: z.string().min(1),
  sectionId: z.string(),
  sequence: z.number().int().nonnegative(),
  role: dialogueRoleSchema.nullable(),
  delivery: deliverySchema,
});
export const podcastGenerationStateSchema = z.object({
  previousSectionClosing: z.string(),
  terminology: z.array(z.object({ term: z.string(), meaning: z.string() })),
  examplesAlreadyUsed: z.array(z.string()),
  speakerContext: z.string(),
});
export const explanationSectionGenerationSchema = z.object({
  turns: z.array(explanationTurnSchema).min(1),
  state: podcastGenerationStateSchema,
});
export const explanationScriptSchema = z
  .object({
    id: z.string(),
    title: z.string(),
    version: z.string(),
    estimatedDurationSeconds: z.number().int().positive(),
    turns: z.array(explanationTurnSchema).min(1),
  })
  .refine(
    ({ turns }) => turns.some((turn) => turn.speaker === 'INSTRUCTOR' || turn.speaker === 'HOST'),
    'Explanation scripts require INSTRUCTOR or HOST',
  );
