# Reproduction guide

## Requirements

- Node.js 22+
- FFmpeg (for full audio runs)
- OpenAI API key
- Notion integration (normal app usage)
- Google Drive OAuth credentials (normal app usage)
- Discord webhook (normal app usage)

For **evaluation only**, in-memory repositories are used — Notion/Drive/Discord are not required when running `npm run eval:*`.

## Setup

```bash
git clone https://github.com/SamuelSSan28/ai-study-podcast-gen.git
cd ai-study-podcast-gen
npm install
cp .env.example .env
```

Fill `.env` per [`docs/environment.md`](../environment.md).

## Run the application

```bash
npm run start:dev
# or
docker compose up --build
```

Create a study plan via API (see [`docs/api.md`](../api.md)).

## Run automated evaluation

### Pilot (3 cases, audio skipped)

```bash
npm run eval:baseline -- --pilot
npm run eval:final -- --pilot
npm run eval:score
npm run eval:report
npm run eval:export-trajectories
```

Or one command:

```bash
npm run eval:all
```

### Full suite (all cases in `evaluation/cases/`)

```bash
npm run eval:baseline
npm run eval:final
npm run eval:score
npm run eval:report
```

### Demo without OpenAI

```bash
npm run eval:demo
```

## Where results appear

| Output | Path |
|---|---|
| Per-run trace | `artifacts/runs/<run-id>/trace.json` |
| Per-run metrics | `artifacts/runs/<run-id>/metrics.json` |
| Aggregated baseline | `evaluation/results/baseline.json` |
| Aggregated final | `evaluation/results/final.json` |
| Human-readable report | `evaluation/results/report.md` |
| Trajectories | `docs/evaluation/trajectories/*.md` |

## Expected output

After `eval:report`, open `evaluation/results/report.md` for the baseline vs final table.

After `eval:export-trajectories`, three markdown trajectory examples are written under `docs/evaluation/trajectories/`.

## Approximate time and cost

| Mode | Cases | Audio | Approx. time | Approx. cost |
|---|---:|---|---|---|
| Pilot eval | 3 | skipped | 15–45 min | $1–5 OpenAI |
| Full eval | 4+ | skipped | depends on case count | depends on OpenAI |
| Showcase audio | 1–3 | full | +30–60 min | +TTS costs |

Set `EVAL_SKIP_AUDIO=false` for full audio on specific runs.

## Known limitations

- Baseline is an automated proxy for manual ChatGPT+TTS workflow, not a timed human study
- Rubric objective matching uses keyword presence (automated, not human review)
- Demo seeds (`eval:demo`) use synthetic traces — replace them with `eval:all` for real metrics

## Verify build quality

```bash
npm run lint
npm test
npm run build
```
