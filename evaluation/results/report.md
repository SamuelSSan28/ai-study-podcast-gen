# Evaluation Report

Generated automatically from `artifacts/runs/*/metrics.json`. Do not edit raw run files manually.

## Summary

| Metric | Baseline | Final workflow | Change |
|---|---:|---:|---:|
| Primary metric (avg rubric score) | 0.9933 | 1 | 0.0067 (0.7%) |
| End-to-end success rate | 1 | 1 | 0.0000 |
| Avg wall clock (ms) | 120000 | 480000 | 360000 |
| Avg estimated cost (USD) | 0.024 | 0.024 | 0.0000 |
| Human steps required | 5 | 0 | -5.00 |

## Baseline runs (3)

- `2867ec8e-e0d5-4090-9165-0e796c26009d` case `case-next-topic-kafka-recovery` score=0.9933 success=true
- `a1b29133-3855-4e22-9196-f267d8958c38` case `case-next-topic-consumer-groups` score=0.9933 success=true
- `e4fc0dff-c5d4-4a7f-a471-7c22298c3b8b` case `case-next-topic-kafka-foundations` score=0.9933 success=true

## Final runs (3)

- `944118f9-7d0f-4236-8ced-0476781df169` case `case-next-topic-kafka-foundations` score=1 success=true
- `9e7ca5a6-77c1-4674-a25a-12906d967ba9` case `case-next-topic-consumer-groups` score=1 success=true
- `c804c8ee-08f7-462a-9cde-851a51c84dd5` case `case-next-topic-kafka-recovery` score=1 success=true

## Reproduce

```bash
npm run eval:baseline -- --pilot
npm run eval:final -- --pilot
npm run eval:score
npm run eval:report
```
