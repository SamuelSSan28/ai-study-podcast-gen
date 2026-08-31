# Evaluation cases

Cases must be **frozen from real project sources** — not invented topic lists.

## Current cases

| File | Source in repo |
|---|---|
| `case-prompt-factory-kafka-backpressure.json` | [`test/prompt-factory.spec.ts`](../../test/prompt-factory.spec.ts) |
| `case-next-topic-kafka-foundations.json` | [`test/next-topic-policy.spec.ts`](../../test/next-topic-policy.spec.ts) |
| `case-next-topic-consumer-groups.json` | [`test/next-topic-policy.spec.ts`](../../test/next-topic-policy.spec.ts) |
| `case-next-topic-kafka-recovery.json` | [`test/next-topic-policy.spec.ts`](../../test/next-topic-policy.spec.ts) |

Plan-level inputs for new cases come from [`docs/api.md`](../../docs/api.md) (`POST /study-plans`). Freeze the **first topic returned** by a real run — do not hand-write topic JSON.

1. Create a roadmap via `POST /study-plans` (see API docs).
2. Export the first (or next) topic JSON from Notion or the API response.
3. Save as `evaluation/cases/<id>.json` with `source` pointing to the run or commit.
4. Re-run `npm run eval:baseline` / `eval:final` on the same files.

Do **not** add generic “Kafka reliability / React state / …” cases unless they came from an actual generated roadmap in this project.
