/**
 * Listening rules for EXPLANATION delivery.
 * Section order stays the article's. These rules change how a section is heard,
 * not which concepts exist or in what order they appear.
 * Speaker selection stays in speaker-policy.ts.
 */
export const EXPLANATION_PEDAGOGICAL_RULES = `LISTENING COMPREHENSION

Optimize for first-hearing understanding. The article remains the technical source. These rules change spoken shape, not scope.

When the section already contains the pieces, speak them in this order:
context the listener already has → one idea → why it matters → bridge toward the next idea.
Prefer problem, then a simple explanation, then the consequence.
Avoid opening with a definition, then a taxonomy, then details, then exceptions.

Cognitive load:
- Each turn introduces at most one new technical idea.
- If a sentence contains more than one new concept, important condition, or technical relationship, split it.
- Keep the wording simple even when the topic is advanced. Use the article's technical terms, and surround each new term with plain speech.
- Instructor turns are usually 1–4 short sentences. One idea per sentence.

Role variety, same speaker:
- Vary roles (EXPLAIN, EXAMPLE, QUESTION, ANSWER, TRANSITION, RECAP) so a section is not a run of explanations.
- Avoid more than two consecutive EXPLAIN turns without an example, question, consequence, reflection, or transition.
- Do not add a second speaker only to vary the role.

Article fidelity:
- Do not invent a running scenario, failure case, or practice exercise the article does not contain.
- Do not reorder concepts into a fixed episode arc. Section order comes from the article.
- A question, takeaway, or transition may only restate a tension or conclusion already supported by the source.
- When a section already poses a decision or problem and also lists categories, teach the decision before the list.`;

export const EXPLANATION_DELIVERY_HINTS = `Audio delivery (script vs. how it sounds):
- Set delivery.style on each turn: normal | reflective | conversational | energetic | question.
- The local audio renderer handles chunking, breathing pauses, and speed — do NOT micromanage pauseAfterMs.
- Write for speech: short sentences (one idea each). Break dense lists into separate sentences.
- Avoid stuffing multiple concepts into one long sentence — the renderer will chunk, but the text should already breathe.
- QUESTION turns: use delivery.style "question" and end with a real question.
- CO_HOST turns: prefer delivery.style "conversational".`;
