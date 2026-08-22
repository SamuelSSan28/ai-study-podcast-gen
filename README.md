# AI Study Podcast Generator

NestJS application that creates coherent backend-engineering study plans, stores their roadmap and episodes in Notion, generates deep technical content and interview-style podcast audio with OpenAI, and announces completed episodes through Discord.

## Status

The first pragmatic MVP is implemented. It includes validated configuration, guarded plan/session generation endpoints, structured OpenAI Responses, tagged local knowledge retrieval, layered duplicate checks, checkpointed retries, Notion repositories, scheduled generation, multi-voice TTS, local audio publication, and Discord notifications. See the [architecture and delivery plan](docs/architecture-and-implementation-plan.md) for decisions and known Notion-locking limitations.

## Setup

1. Use Node.js 22 or newer and install dependencies with `npm install`.
2. Copy `.env.example` to `.env` and provide OpenAI, Notion, and Discord credentials.
3. In Notion, create the Study Plans and Topics/Sessions databases described below, share them with the integration, and set their IDs.
4. Add personal `.md` or `.txt` sources under `knowledge/`.
5. Run `npm run start:dev`.

The plans database needs properties `Name` (title), `App ID` and `Goal` (rich text), `Status` (select), and `Metadata` (rich text). The sessions database needs `Name` (title), `App ID`, `Plan ID`, `Slug`, `Generation Key`, and `Metadata` (rich text), `Record Type` and `Status` (select), `Week` and `Sequence` (number), `Tags` (multi-select), and `Audio URL` (URL).

## API

```text
POST /study-plans/generate?token=...
GET  /study-plans
GET  /study-plans/:id
POST /study-plans/:id/generate-next?token=...
GET  /study-plans/:id/sessions
GET  /sessions/:id
POST /sessions/:id/retry?token=...
GET  /audio/:sessionId
```

The query token is an isolated MVP requirement. Do not log request URLs, use HTTPS, and replace it with header-based authentication before exposing the service broadly. The audio route is intentionally simple for a personal deployment; place it behind authentication or use object storage/signed delivery for a public deployment.
