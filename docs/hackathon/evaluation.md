# Evaluation methodology

## Goal

Compare **baseline** (degraded single-prompt flow) vs **final** (orchestrated agentic workflow) on identical frozen cases with automated metrics only.

## Primary metric

**Average rubric score** (0–1) from `evaluation/rubrics/session-quality.json`:

| Subscore | Weight | How it is computed |
|---|---:|---|
| objective_coverage | 0.30 | Keyword match of `expectedObjectives` in generated content |
| grounding | 0.25 | Based on `source_count` from web research (final mode) |
| structural_validity | 0.20 | Validator pass/fail from trace |
| completion | 0.15 | End-to-end success boolean |
| efficiency | 0.10 | Inverse of wall-clock time (capped at 30 min) |

## Secondary metrics (automatic)

- `end_to_end_success_rate`
- `wall_clock_ms` per run
- `estimated_cost_usd` from token usage
- `human_steps_required` (baseline=5, final=0)
- `validation_pass_rate`
- `retry_count` / recovery experiments

## Cases

Four cases frozen from existing tests — see [`evaluation/cases/README.md`](../../evaluation/cases/README.md). Add more by exporting topics from real `POST /study-plans` runs, not from a generic list.

## Running evaluation

```bash
cp .env.example .env   # fill OPENAI_API_KEY and other required vars

npm run eval:baseline -- --pilot   # 3 cases
npm run eval:final -- --pilot
npm run eval:score
npm run eval:report
```

Results: [`evaluation/results/report.md`](../../evaluation/results/report.md)

## Experiments

```bash
npm run eval:experiment -- --toggle=skip-web-research --pilot
npm run eval:report
```

Available toggles: `skip-web-research`, `skip-duplicate-check`, `skip-prior-context`, `skip-validator`, `inject-script-failure`.

## Rules

1. Define rubric weights before final run
2. Never hand-edit `artifacts/runs/*/metrics.json`
3. Regenerate reports only via `npm run eval:report`
4. Use the same cases for baseline and final comparisons
