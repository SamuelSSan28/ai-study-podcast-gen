# Improvement Changelog

Experiment history for the hackathon. Each entry links to automated metrics in `evaluation/results/report.md` and raw runs in `artifacts/runs/`.

## Baseline — generic single prompt

### Hypothesis

A single generic LLM prompt (content + script together) is the common manual shortcut and should score lower on grounding, structure, and orchestration efficiency than the full pipeline.

### What we ran

`npm run eval:baseline -- --pilot` with `EVAL_SKIP_AUDIO=true`

### Evidence

- `human_steps_required = 5` (simulated manual coordination steps)
- Lower grounding subscore when `source_count = 0`
- See baseline section in [`evaluation/results/report.md`](../../evaluation/results/report.md)

### Result

Baseline completes but lacks research grounding and pipeline validation.

### Decision

Keep as comparison anchor for all final/experiment runs.

---

## Iteration 1 — web research stage

### Why we tried it

Baseline and model-only content risk stale or ungrounded facts for fast-moving topics (see Kafka fixtures in `test/` and `evaluation/cases/`).

### Change

Added `researchTopic()` with required web search before content generation (PR #11, commit `6b62e0d`).

### Same evaluation cases

All cases in `evaluation/cases/`

### Evidence

- `source_count > 0` on final runs
- Grounding rubric subscore increases vs baseline
- Experiment: `npm run eval:experiment -- --toggle=skip-web-research --pilot`

### Decision

**Kept** — grounding metric confirms value.

---

## Iteration 2 — validator before TTS

### Why we tried it

Invalid scripts (missing sections, bad turn counts) waste expensive TTS/audio stages.

### Change

`PodcastScriptValidator` runs after polish, before audio (PR #5 lineage).

### Evidence

- `validation_pass_rate` tracked in traces
- Experiment toggle: `--toggle=skip-validator`

### Decision

**Kept** — fails fast with clear errors; reduces wasted audio work.

---

## Iteration 3 — prior-session context in conversation planner

### Why we tried it

Standalone prompts repeat explanations already covered in earlier sessions.

### Change

Pass `previousSessions` summaries into conversation planning.

### Evidence

- Trace records `priorSessionCount`
- Experiment toggle: `--toggle=skip-prior-context`

### Decision

**Kept** for multi-session plans; measurable via redundancy-related rubric checks.

---

## Iteration 4 — semantic duplicate check

### Why we tried it

Roadmaps can propose topics too similar to completed sessions.

### Change

`validateDuplicate()` + `selectNextTopic()` rejection reasons in trace.

### Evidence

- `duplicateChecks[]` in `trace.json`
- Experiment toggle: `--toggle=skip-duplicate-check`

### Decision

**Kept** — prevents redundant session generation on long roadmaps.

---

## Iteration 5 — checkpoints + retry

### Why we tried it

Full pipeline restarts are costly when audio or upload fails late.

### Change

Stage checkpoints persisted on `StudySession`; `retry()` resumes from last successful stage.

### Evidence

- `retry_count`, `stage_timings_ms` in metrics
- Experiment toggle: `--toggle=inject-script-failure`

### Decision

**Kept** — recovery without restarting research/content/script stages.

---

## Rejected / not added

- Multi-agent branding without measured gain
- Vector DB / LangChain — web search + structured context sufficient today
- Autonomous unbounded loops — explicit stage machine preferred
