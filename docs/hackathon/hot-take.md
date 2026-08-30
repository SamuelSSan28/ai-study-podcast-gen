# Hot take

> Generated from observed failure modes in automated eval — update after live `eval:all` runs.

The biggest measurable gap between baseline and final is not "more AI" — it is **where deterministic code stops expensive mistakes**.

A single generic prompt can produce fluent text quickly, but it skips three things that matter for study sessions:

1. **Current grounding** — without the web research stage, `source_count` stays at zero and grounding subscore collapses on fast-moving topics.
2. **Structural validity before TTS** — the validator is cheap code that prevents obviously broken scripts from reaching the most expensive stage.
3. **Continuity** — prior-session context and duplicate checking reduce repetition that sounds fine in isolation but frustrates learners across a 18-session roadmap.

The surprising result from pilot metrics: baseline rubric scores look deceptively high on keyword coverage because objectives are easy to mention without teaching them well. Grounding and validation subscores separate "mentions Kafka idempotency" from "builds a session worth listening to."

**Failure mode to watch:** skipping validation to save time passes short pilot runs but fails on edge cases (turn count, missing sections) — the kind of issue that only appears once you automate at scale.

**What we rejected:** adding multi-agent or RAG infrastructure without a measured retrieval problem — web search + structured stages was enough for this domain.
