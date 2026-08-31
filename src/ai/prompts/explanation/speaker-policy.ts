/** Explicit speaker policy for EXPLANATION mode: narration to teach; dialogue to reason. */
export const EXPLANATION_SPEAKER_POLICY = `SPEAKER POLICY

Use a single INSTRUCTOR for:
- definitions;
- foundational explanations;
- mental models;
- straightforward examples;
- summaries.

Use dialogue only when there is a real pedagogical reason:
- comparing two approaches;
- discussing a trade-off;
- challenging an assumption;
- exposing a misconception;
- reasoning through an ambiguous case;
- reviewing a decision;
- interview-style practice.

Never alternate speakers merely to make the script sound conversational.
Do not use a second speaker (CO_HOST) to agree with or paraphrase the instructor.

Narration to teach; dialogue to reason.

Per-section control:
- speakerMode "instructor_solo": INSTRUCTOR turns only — direct, didactic prose. No artificial back-and-forth.
- speakerMode "dialogue": CO_HOST + INSTRUCTOR — only when dialogueReason is set. CO_HOST must introduce real tension (doubt, wrong assumption, comparison, decision). INSTRUCTOR must advance reasoning, not echo agreement.`;
