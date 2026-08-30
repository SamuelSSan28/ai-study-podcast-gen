# Pre-existing vs hackathon work

This document separates capabilities that existed before the hackathon from work added to support evaluation, observability, and submission.

## Snapshot reference

- **Tag:** `pre-hackathon-baseline` → commit `9f8e919` (before web research integration)
- **Current head:** includes automated evaluation, run tracing, and hackathon documentation

## Before the hackathon

| Capability | Evidence |
|---|---|
| NestJS backend with study plan + session APIs | `389d4df` — MVP |
| Notion auto-provisioning | PR #2 — `c45d7d8` |
| Google Drive audio upload | PR #3 — `f01bd19` |
| Next-topic eligibility policy | `d2535ab` |
| Turn-based TTS + FFmpeg pipeline | PR #5 — `08932d2` |
| DISCUSSION + INTERVIEW podcast modes | PR #6 — `a964dfe` |
| Global API token guard | PR #8 — `bd3014d` |
| Environment documentation | PR #8 — `fef1bdf` |
| Docker Compose dev setup | PR #9 — `d06c511` |
| Automatic 18-session curriculum from title + goal | PR #10 — `37f185b` |
| Web research for current sources | PR #11 — `6b62e0d` |
| Compose hot reload | PR #12 — `d8e8651` |

Core orchestration already present before submission prep:

- Semantic duplicate check (`NEW` / `RELATED_BUT_DEEPER` / `DUPLICATE`)
- Generation key idempotency
- Multi-stage checkpoints and retry
- Conversation planning with prior-session context
- Script polish + validator before TTS
- Prompt/model version tracking on sessions

## Added or changed during the hackathon

| Change | Purpose |
|---|---|
| `RunTraceService` + `artifacts/runs/` | Automatic per-run metrics and trajectories |
| `evaluation/` cases, rubrics, results | Frozen eval set and auto-generated reports |
| `scripts/run-baseline.ts`, `run-evaluation.ts`, etc. | Automated baseline vs final comparison |
| Eval toggles (`EVAL_SKIP_*`, `EVAL_INJECT_FAILURE_STAGE`) | Targeted experiments with metric diffs |
| In-memory eval repositories | Reproducible eval without Notion side effects |
| `docs/hackathon/*` | Submission narrative, reproduction, trajectories |
| README hackathon section + metric table | Landing page for judges |

## Why the change mattered

The product already automated session generation. The hackathon work makes that automation **measurable and reproducible**: same cases, same rubric, baseline vs final scores from `npm run eval:report` instead of manual claims.

See [`evaluation/results/report.md`](../../evaluation/results/report.md) for measured outcomes after running the eval suite.
