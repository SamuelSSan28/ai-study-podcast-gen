import { EXPLANATION_SPEAKER_POLICY } from './speaker-policy';

/** Shared didactic rules for EXPLANATION mode script generation. */
export const EXPLANATION_PEDAGOGICAL_RULES = `Core teaching principle: teach through decisions, not definitions.

Episode structure (sections must follow this order):
1. HOOK — a concrete problem the learner recognizes.
2. LEARNING_PROMISE — what decision or skill they will have at the end.
3. SETUP — introduce ONE running scenario used throughout the episode.
4. DISCOVERY — introduce concepts only when a problem requires them (progressive discovery).
5. GUIDED_PRACTICE — apply the rule; use dialogue only if the section has speakerMode "dialogue".
6. FAILURE — show a wrong architectural choice and its consequence in the running scenario.
7. CORRECTION — fix the mistake using the rule learned.
8. INDEPENDENT_CHECK — 2–3 quick cases; leave a beat before revealing answers (instructor solo with pauses, not forced dialogue).
9. MENTAL_MODEL — one simple rule the learner can reuse.
10. RECAP — at most 3 points.

Script rules:
- Every episode has exactly one centralQuestion that the whole script answers.
- Use the runningScenario for all examples — do not jump between unrelated systems.
- Never explain more than one new concept per instructor turn.
- Instructor turns: usually 1–4 sentences; avoid paragraphs longer than ~60 spoken words.
- Break dense technical lists into short spoken sentences (one idea per sentence).
- Do not introduce a concept without a concrete example from the running scenario.
- Do not summarize concepts before the learner has applied them.
- End with an actionable mental model, not a list of definitions.
- Cover only what this episode's centralQuestion needs — and only concepts present in the source article.

${EXPLANATION_SPEAKER_POLICY}

Co-host rules (only in sections with speakerMode "dialogue"):
- CO_HOST must reason, question, attempt answers, or make realistic mistakes.
- Never use CO_HOST only for "Quick FAQ" prompts or to agree/paraphrase the instructor.
- CO_HOST represents the learner — confused, trying, sometimes wrong.
- Dialogue should feel like reasoning through a decision, not an article read aloud.

Anti-patterns to avoid:
- Dumping all taxonomy upfront (e.g. listing four state types before any problem).
- Repeating "concept → explanation → example → FAQ" for every idea.
- Independent unrelated examples (modal, auth, dashboard) instead of one system.
- Alternating speakers on foundational definitions just to sound conversational.
- FAQ segments labeled "Quick FAQ" — use natural dialogue only where dialogueReason justifies it.`;

export const EXPLANATION_DELIVERY_HINTS = `Audio delivery (script vs. how it sounds):
- Set delivery.style on each turn: normal | reflective | conversational | energetic | question.
- The local audio renderer handles chunking, breathing pauses, and speed — do NOT micromanage pauseAfterMs.
- Write for speech: short sentences (one idea each). Break dense lists into separate sentences.
- Avoid stuffing multiple concepts into one long sentence — the renderer will chunk, but the text should already breathe.
- QUESTION turns: use delivery.style "question" and end with a real question.
- CO_HOST turns: prefer delivery.style "conversational".`;
