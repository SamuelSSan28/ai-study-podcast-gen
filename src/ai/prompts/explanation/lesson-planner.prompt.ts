import { CreateConversationPlanInput } from '../../../domain/models';
import { EXPLANATION_SPEAKER_POLICY } from './speaker-policy';
import { formatPlannerSourceArticle, PLANNER_ARTICLE_FIDELITY } from '../scope-discipline';

export const EXPLANATION_PLANNER_PROMPT_VERSION = 'lesson-planner.explanation.v6';

export function buildExplanationPlannerPrompt(input: CreateConversationPlanInput): string {
  return `Plan how the canonical article should be taught in audio. Do not invent a second lesson and do not write dialogue.

Use the article's conceptual progression as the default podcast progression. Do not reorganize it
just to appear dynamic. Reorder only when spoken clarity requires it, without changing conceptual
dependencies. Create one plan section for each relevant article section, in article order.

For each section return only:
- articleSectionId: the exact source article section id;
- purpose: how this part should be taught in audio, not new technical content;
- speakerMode: instructor_solo or dialogue;
- dialogueReason: misconception, comparison, tradeoff, or decision when dialogue is justified; otherwise null;
- recap: whether this section should close with a concise recap.

NARRATION TO TEACH. DIALOGUE TO REASON.
Use instructor_solo by default for definitions, mental models, foundational explanations,
straightforward examples, and summaries. Use dialogue only for an identifiable misconception,
comparison, tradeoff, or decision. If there is no dialogueReason, use instructor_solo. Do not invent
company context, incidents, scale, constraints, failures, cases, examples, FAQs, or scenarios.

${EXPLANATION_SPEAKER_POLICY}
${PLANNER_ARTICLE_FIDELITY}

Set mode to EXPLANATION and provide version and title.
${formatPlannerSourceArticle(input)}`;
}
