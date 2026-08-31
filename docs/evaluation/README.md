# Workflow Evaluation — AI Study Podcast Generator

## User and problem

Software engineers and self-directed technical learners know what they want to study, but repeatedly spend time on session-level orchestration: researching current sources, synthesizing written material, adapting it to a podcast script, generating audio, and tracking what was already covered.

The bottleneck is not lack of content on the internet — it is **repeated manual coordination** across research, synthesis, format adaptation, and continuity.

## Current / manual workflow (baseline proxy)

For each study session, a learner typically:

1. Researches sources manually
2. Writes or prompts generic study notes
3. Adapts notes into a conversational script
4. Generates audio via external TTS
5. Organizes artifacts and decides what comes next

Our **automated baseline** (`npm run eval:baseline`) simulates the common shortcut: one generic prompt that tries to produce content + script at once, without orchestration, web research pipeline, validation, or checkpoints.

## Automated workflow (final system)

```text
Title + Goal → AI roadmap → persisted plan
  → next-topic selection + semantic duplicate check
  → web research → technical content
  → conversation plan (with prior-session context)
  → script → polish → validator
  → TTS + upload + notification
  → checkpoints + retry + generation key idempotency
```

Each stage emits trace metrics automatically via `RunTraceService`.

## Why these AI capabilities are used

| Capability | Role |
|---|---|
| Web research | Ground content in current authoritative sources |
| Structured multi-stage generation | Reduce format-mixing errors vs one-shot prompts |
| Prior-session context | Improve continuity, reduce repetition |
| Semantic duplicate check | Skip redundant roadmap topics |
| Validator before TTS | Block structurally invalid scripts early |
| Checkpoints | Recover from failures without full restart |

Deterministic code handles orchestration, persistence, scheduling, idempotency, and validation rules.

## Evaluation summary

Latest auto-generated report: [`evaluation/results/report.md`](../../evaluation/results/report.md)

| Metric | Baseline | Final | Change |
|---|---:|---:|---|
| Avg rubric score | see report | see report | see report |
| Human steps required | 5 | 0 | -5 |
| End-to-end success | see report | see report | see report |

Run `npm run eval:all` with OpenAI credentials for live measurements. `npm run eval:demo` seeds pilot data for structure verification.

## Main improvement

The orchestrated workflow removes manual session coordination (`human_steps_required: 0`) while improving rubric scores through grounded research, validation, and staged generation. See [`improvement-changelog.md`](improvement-changelog.md).

## Main failure mode

Without web research (`EVAL_SKIP_WEB_RESEARCH=true`), grounding subscore drops — factual freshness depends on the research stage, not model memory alone.

## Reproduce it

See [`reproduction.md`](reproduction.md).

## Evaluation resources

- [x] Solution code + [`improvement-changelog.md`](improvement-changelog.md)
- [x] [`reproduction.md`](reproduction.md)
- [x] Agent trajectories in [`trajectories/`](trajectories/)
