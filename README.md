# AI Study Podcast Generator

An orchestrated AI workflow that turns a learning goal into a persisted technical study roadmap and automatically prepares study sessions using current research, previous-session context, validation checks, and recoverable generation stages.

You provide only a **title + goal**. The system plans 18 sessions, researches each topic, generates technical content and conversational podcast scripts, validates output before audio, uploads episodes, and tracks progress in Notion.

## How it works

1. You provide a curriculum title and learning goal.
2. OpenAI creates a progressive 18-session roadmap (Monday/Wednesday/Friday, 45-minute defaults).
3. The roadmap and session state are stored in **SQLite** (operational source of truth); readable content is mirrored to Notion.
4. The first topic is generated via **BullMQ** workers. Mark a topic as studied in the **web dashboard** (or API) to advance the roadmap.
5. OpenAI web search builds a current factual foundation from authoritative sources.
6. The pipeline generates technical content, a conversation plan (with prior-session context), a polished script, and audio in recoverable stages. Episodes can be `DISCUSSION` or `INTERVIEW` mode.
7. Audio is uploaded to **Google Drive**; episodes are available via the API and announced on Discord.

Episodes can also be generated manually through the HTTP API.

## Stack

- Node.js 22, TypeScript, NestJS
- **SQLite** (Prisma) + **Redis** (BullMQ job queues)
- OpenAI Responses API (structured JSON) and TTS
- Notion for readable study material (dual-write, best-effort)
- Google Drive or local disk for public audio hosting
- Discord webhooks for notifications
- Bootstrap web dashboard at `/`
- Jest for tests

## Architecture

```text
src/
├── ai/                # OpenAI prompts, schemas, gateway
├── application/       # use cases and persistence contracts
├── audio/             # TTS, FFmpeg, Google Drive, local streaming
├── conversation/      # planning, script, polish, validation
├── domain/            # models, topic selection, duplicate prevention
├── observability/     # RunTraceService for automated eval metrics
├── eval/              # in-memory eval runners and rubric scoring
├── persistence/       # SQLite (Prisma) + Notion content publisher
├── queue/             # BullMQ processors
├── scheduler/         # cron-based progress checks
├── web/               # Bootstrap dashboard (static)
├── study-plans/       # roadmap API
└── study-sessions/    # session and retry API
```

### Session pipeline checkpoints

Generation persists progress through these stages (retry resumes after the last successful one):

`CONTENT_PENDING` → `CONTENT_READY` → `CONVERSATION_PLAN_READY` → `SCRIPT_READY` → `DIALOGUE_READY` → `AUDIO_READY` → `UPLOADED` → `COMPLETED`

A generation key derived from plan + topic + mode prevents duplicate sessions for the same roadmap item.

## Running locally

### Requirements

- Node.js 22+
- FFmpeg (for audio composition)
- **Redis** (job queues — `docker compose` includes a Redis service)
- OpenAI API key
- Notion integration + parent page
- Google Drive OAuth credentials (see [environment docs](docs/environment.md)) — optional if using local audio
- Discord webhook

### Setup

```bash
git clone <repository-url>
cd ai-study-podcast-gen
npm install
cp .env.example .env
```

Fill in `.env`. Share an empty Notion page with your integration and set `NOTION_PARENT_PAGE_ID`. On startup, the app creates the required databases under that page and a SQLite database at `./data/app.db`.

```bash
mkdir -p data
npm run db:migrate   # first time only
npm run start:dev
```

- **API:** `http://localhost:3000`
- **Dashboard:** `http://localhost:3000/` (paste your `STUDY_PLAN_CREATE_TOKEN` in the UI)

### Docker Compose

```bash
cp .env.example .env
docker compose up --build
```

Compose mounts `src/` and `web/` for hot reload, persists SQLite in `./data`, audio in the `podcast-audio` volume, and starts **Redis** for BullMQ.

## Workflow evaluation

This project includes automated baseline vs final workflow evaluation:

| Metric | Baseline | Final workflow | Change |
|---|---:|---:|---|
| Primary metric (avg rubric score) | _run `npm run eval:report`_ | _run `npm run eval:report`_ | _auto_ |
| Human active steps / session | 5 (baseline design) | 0 (orchestrated) | -5 |
| End-to-end success rate | _measured_ | _measured_ | _measured_ |

_Regenerate the table with `npm run eval:all` after filling `.env`. Cases come from repo tests — see [`evaluation/cases/README.md`](evaluation/cases/README.md)._

### Evaluation docs

- [Evaluation overview](docs/evaluation/README.md)
- [Improvement changelog](docs/evaluation/improvement-changelog.md)
- [Evaluation methodology](docs/evaluation/evaluation.md)
- [Reproduction guide](docs/evaluation/reproduction.md)
- [Agent trajectories](docs/evaluation/trajectories/)

### Eval commands

```bash
npm run eval:baseline -- --pilot
npm run eval:final -- --pilot
npm run eval:report
npm run eval:export-trajectories
npm run eval:all          # full automated pipeline
```

## Documentation

- [API reference](docs/api.md)
- [curl examples (generate roadmaps & episodes)](docs/curl-examples.md)
- [Environment variables](docs/environment.md)
- [OpenAI integration (Responses API, schemas, TTS)](docs/openai-integration.md)
- [Architecture plan](docs/architecture-and-implementation-plan.md)
- [Evaluation README](evaluation/README.md)

## Scripts

```bash
npm run start:dev   # development with reload
npm run build       # production build
npm run lint        # static analysis
npm test            # unit tests
npm run test:cov    # coverage
```

## Contributing

1. Keep external integrations behind contracts in `src/application/ports.ts`
2. Add tests for domain rules and bug fixes
3. Run `npm run lint`, `npm test`, and `npm run build`
