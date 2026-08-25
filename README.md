# AI Study Podcast Generator

A project that turns real-world software scenarios into technical learning paths and AI-generated podcast episodes.

The goal is to study the engineering decisions behind concrete use cases: how a technology or architecture works, which trade-offs it introduces, and when it is—or is not—a good fit. The application organizes those questions into a progressive roadmap, enriches each topic with local notes, and produces conversational episodes that connect theory to project constraints.

## How it works

1. You describe the system, use case, or technical decision you want to explore, along with your experience level, study duration, and frequency.
2. OpenAI creates a roadmap around the relevant concepts, design choices, trade-offs, and alternatives.
3. The roadmap and session state are stored in Notion.
4. At the configured time, the scheduler selects the next eligible topic.
5. Files under `knowledge/` provide additional context.
6. The application generates use-case-driven technical content, a conversational script, and audio in recoverable stages. Each episode can be a peer `DISCUSSION` or an `INTERVIEW` simulation while sharing the same content and audio pipeline.
7. The episode becomes available through the API and is announced on Discord.

Episodes can also be generated manually through the HTTP API.

## Stack

- Node.js 22, TypeScript, and NestJS
- OpenAI Responses API and text-to-speech
- Notion for roadmap and session persistence
- Discord webhooks for notifications
- Jest for tests

## Architecture

The codebase separates domain rules, use cases, and external integrations:

```text
src/
├── ai/                # OpenAI prompts, schemas, and gateway
├── application/       # use cases and persistence contracts
├── audio/             # local MP3 storage and delivery
├── domain/            # models, topic selection, and duplicate prevention
├── knowledge-base/    # local context discovery and retrieval
├── persistence/       # Notion repository implementation
├── scheduler/         # cron-based automatic generation
├── study-plans/       # roadmap API
└── study-sessions/    # session and retry API
```

Session generation uses checkpoints (`CONTENT_READY`, `SCRIPT_READY`, and `AUDIO_READY`). If a stage fails, retry resumes after the last completed checkpoint instead of restarting the entire pipeline. A key derived from the roadmap and topic prevents duplicate sessions for the same roadmap item.

## Running locally

### Requirements

- Node.js 22+
- an OpenAI API key
- a Notion integration
- a Discord webhook

### Setup

```bash
git clone <repository-url>
cd ai-study-podcast-gen
npm install
cp .env.example .env
```

Fill in `.env`. In Notion, share an empty page with your integration and set its ID as `NOTION_PARENT_PAGE_ID`. On startup, the application creates or updates the required roadmap and session databases under that page.

Add personal `.md` or `.txt` sources under `knowledge/`. Tags can be declared on the first line:

```md
tags: kafka, distributed-systems
```

Start the development server:

```bash
npm run start:dev
```

The API is available at `http://localhost:3000` by default.

## Documentation

- [API reference and examples](docs/api.md)
- [Environment variables](docs/environment.md)
- [Architecture and implementation plan](docs/architecture-and-implementation-plan.md)

## Scripts

```bash
npm run start:dev  # development with reload
npm run build      # production build
npm run lint       # static analysis
npm test           # unit tests
npm run test:cov   # test coverage
```

## Contributing

Issues and pull requests are welcome. Before submitting a change:

1. keep external integrations behind the contracts in `src/application/ports.ts`;
2. add tests for domain rules and bug fixes;
3. run `npm run lint`, `npm test`, and `npm run build`.
