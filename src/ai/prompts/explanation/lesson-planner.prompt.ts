import { CreateConversationPlanInput } from '../../../domain/models';
import { EXPLANATION_PEDAGOGICAL_RULES } from './pedagogical-rules';
import { EXPLANATION_SPEAKER_POLICY } from './speaker-policy';
import {
  formatPlannerSourceArticle,
  PLANNER_ARTICLE_FIDELITY,
} from '../scope-discipline';

export const EXPLANATION_PLANNER_PROMPT_VERSION = 'lesson-planner.explanation.v5';

export function buildExplanationPlannerPrompt(input: CreateConversationPlanInput): string {
  return `Plan a didactic spoken lesson about the topic below. Do not write dialogue.

First define:
- centralQuestion: the ONE decision or skill the learner must answer alone at the end — derived from the article's learning objectives.
- runningScenario: one concrete example taken from the source article (name, short description, 3–6 components the episode will classify or decide about). Do not invent a unrelated system.
- deliveryApproach and deliveryRationale:
  - solo_lecture: entire episode is instructor-solo (all sections speakerMode "instructor_solo"; zero CO_HOST). Use for purely linear foundational topics.
  - instructor_with_faq: instructor-led with selective dialogue moments — majority of sections instructor_solo; mark speakerMode "dialogue" only where the article has real pedagogical tension (comparison, trade-off, misconception, decision). Do not invent FAQ segments.
  - guided_walkthrough: procedural walkthrough of runningScenario; dialogue concentrated in practice beats (GUIDED_PRACTICE, FAILURE, CORRECTION) when decisions exist; foundational beats remain instructor_solo.

Then create sections following the episode beats in order:
HOOK → LEARNING_PROMISE → SETUP → DISCOVERY (one or more) → GUIDED_PRACTICE → FAILURE → CORRECTION → INDEPENDENT_CHECK → MENTAL_MODEL → RECAP.

Map discovery and practice sections to article sections in order. Each section's concept, examples, and realWorldCases must come from the source article.

For each section provide:
- id (kebab-case), episodeBeat, topic, objective
- concept (what is introduced — empty for HOOK/SETUP beats that only frame the problem)
- examples and realWorldCases drawn from runningScenario only
- speakerMode: "instructor_solo" | "dialogue" — derive from article content, not from beat name alone
- dialogueReason: required when speakerMode is "dialogue" (comparison | tradeoff | misconception | ambiguous_case | decision_review | interview_practice); null when instructor_solo
- coHostMoments: only when speakerMode is "dialogue" — moments where CO_HOST should try, guess wrong, or push back (not FAQ labels); empty array for instructor_solo
- keyTakeaways (only for RECAP and MENTAL_MODEL sections; max 3 items in RECAP)

Default speakerMode by beat (override when article content says otherwise):
- HOOK, LEARNING_PROMISE, SETUP, DISCOVERY, MENTAL_MODEL, RECAP, INDEPENDENT_CHECK → instructor_solo
- GUIDED_PRACTICE, FAILURE, CORRECTION → dialogue only if the article has a real decision/comparison/misconception; otherwise instructor_solo
- Purely definitional DISCOVERY (e.g. "what is useState") must stay instructor_solo even if other beats use dialogue

Cadence example (useState-style topic — narration for foundations, dialogue only at decision points):
instructor_solo: what is useState → when a value deserves state → short example → derived state → colocation
dialogue: "but when two components need the value?"
instructor_solo: lifting state
dialogue: compare local vs lifted
instructor_solo: final rule

${EXPLANATION_SPEAKER_POLICY}

${PLANNER_ARTICLE_FIDELITY}

${EXPLANATION_PEDAGOGICAL_RULES}

Set mode to EXPLANATION.

${formatPlannerSourceArticle(input)}
Previous sessions (background only — do not expand scope): ${JSON.stringify(input.previousSessions ?? [])}
Study plan context (background only): ${JSON.stringify(input.studyPlanContext)}`;
}
