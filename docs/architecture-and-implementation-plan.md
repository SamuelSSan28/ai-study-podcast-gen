# Architecture and Implementation Plan

## 1. Purpose, scope, and MVP decisions

This document is the executable design for a production-minded personal study automation system. The MVP generates a coherent, configurable study roadmap; persists it in Notion; advances through that roadmap on scheduled days; produces an English technical deep dive and a self-contained interview conversation; synthesizes and publishes audio; and notifies Discord.

The application is a **modular monolith** built with Node.js, NestJS, and TypeScript. That is the pragmatic choice for one owner and one workflow: it gives explicit domain boundaries and replaceable adapters without adding distributed deployment, queues, or another database prematurely. Long-running work initially runs in the API process. The use-case boundary allows it to move to a worker/queue later.

### MVP decisions

- Notion is the system of record for plan, topic, session, generation, and notification metadata. The local filesystem stores generated audio bytes; current technical facts come from OpenAI web search.
- The roadmap, rather than a fresh random AI suggestion, determines the next session. AI can refine the scenario while preserving its learning objective and prerequisites.
- Two Notion databases provide queryable records. Nested child pages provide readable navigation.
- Structured OpenAI Responses outputs are validated again locally with Zod. Invalid outputs are rejected rather than loosely parsed.
- Generated audio is served by an authenticated-or-unguessable public download route from persistent local storage for a single-instance MVP. Production deployments that cannot guarantee a durable disk should use object storage immediately.
- One scheduled slot maps to one deterministic generation key. A Notion claim reduces accidental duplicates, but Notion is not a transactional lock; this limitation and the stronger evolution path are explicit in section 12.
- No embeddings, vector database, message broker, or relational database is introduced in the first release.

### Non-goals for the first release

- General-purpose learning management, multi-user tenancy, a web UI, real-time progress updates, semantic vector search, studio-quality mixing, and arbitrary source-document parsing.
- Perfect multi-instance mutual exclusion. Operate a single scheduler replica initially and retain idempotency protections.

## 2. System context and dependency direction

```text
Manual REST calls                 @nestjs/schedule
       |                                 |
       +----------> application use cases <----------+
                            |                         |
                  domain entities/policies           |
                            |                         |
          +-----------------+------------------+      |
          |                 |                  |      |
       AI ports       repository ports   notification/audio ports
          |                 |                  |
   OpenAI adapters     Notion adapters    OpenAI TTS / local disk /
                                           Discord / HTTP delivery
```

Dependencies point inward: controllers, cron jobs, SDK adapters, and filesystem code invoke application ports and use cases; they do not own business rules. Domain and application code never imports the Notion or OpenAI SDK. The composition root binds symbols to adapters.

## 3. Proposed source layout and NestJS boundaries

```text
src/
  app.module.ts
  config/
    configuration.ts
    env.schema.ts
    ai-model.config.ts
  common/
    auth/generation-token.guard.ts
    errors/ retry/ logging/ ids/ clock/
  domain/
    study-plan/ study-topic/ study-session/
    policies/topic-normalization.ts
    policies/stage-transition.policy.ts
  application/
    ports/
    study-plans/generate-study-plan.use-case.ts
    study-sessions/generate-next-study-session.use-case.ts
    study-sessions/resume-study-session.use-case.ts
    study-sessions/get-*.query.ts
  study-plans/
    study-plans.module.ts
    study-plans.controller.ts
    dto/
  study-sessions/
    study-sessions.module.ts
    study-sessions.controller.ts
    dto/
  ai/
    ai.module.ts
    openai-responses.adapter.ts
    generators/
    schemas/
    prompts/*.prompt.ts
  audio/
    audio.module.ts
    openai-audio.generator.ts
    turn-parser.ts tts-chunker.ts audio-composer.ts
    local-audio.storage.ts
  persistence/notion/
    notion.module.ts notion.client.ts
    repositories/ mappers/ block-renderers/ schemas/
  notifications/discord/
    discord.module.ts discord.notifier.ts
  scheduler/
    scheduler.module.ts podcast.scheduler.ts
storage/podcasts/                 # ignored; persistent volume in deployment
```

`StudyPlansModule` and `StudySessionsModule` expose HTTP transport. Application use cases are the transaction/workflow boundary. `AiModule`, `NotionModule`, `AudioModule`, and `DiscordModule` are adapter/capability modules. The scheduler is deliberately thin: it finds active plans due for the current slot and invokes `GenerateNextStudySessionUseCase`.

Use injection tokens such as `STUDY_PLAN_REPOSITORY`, `STUDY_SESSION_REPOSITORY`, `STUDY_CONTENT_GENERATOR`, `AUDIO_STORAGE`, and `SESSION_NOTIFIER`. Interfaces live in the application layer; implementations live in infrastructure modules.

## 4. Domain model

All IDs below are application-generated UUIDs, independent of Notion page IDs. Dates are UTC instants except `LocalDate`, and slugs are normalized value objects.

### StudyPlan aggregate

```ts
type StudyPlanStatus = 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'ARCHIVED';

interface StudyPlan {
  id: string;
  title: string;
  goal: string;
  englishLevel: 'B2' | 'B2_C1' | 'C1';
  durationWeeks: number;
  sessionsPerWeek: number;
  preferredDays: Weekday[];
  startDate: string; // LocalDate
  endDate: string;
  status: StudyPlanStatus;
  overview: string;
  progressionRationale: string;
  notionPageId?: string;
  notionUrl?: string;
  createdAt: string;
  updatedAt: string;
  version: number;
}
```

Rules: duration and frequency have configured bounds; total topics equals `durationWeeks * sessionsPerWeek`; preferred days match frequency; only one plan is active by default; activation requires a complete roadmap. `version` supports diagnostic optimistic checks even though Notion cannot guarantee compare-and-swap.

### StudyPlanTopic entity

```ts
type TopicStatus = 'PLANNED' | 'CLAIMED' | 'GENERATING' | 'READY' |
  'FAILED' | 'SKIPPED';

interface StudyPlanTopic {
  id: string;
  studyPlanId: string;
  title: string;
  normalizedTitle: string;
  slug: string;
  scenario: string;
  learningObjectives: string[];
  prerequisites: string[];
  summary: string;
  week: number;
  sequenceInWeek: number;
  absoluteSequence: number;
  difficulty: 'FOUNDATIONAL' | 'INTERMEDIATE' | 'ADVANCED';
  tags: string[];
  depthDelta: string; // why related material advances rather than repeats
  status: TopicStatus;
  claimedBy?: string;
  claimedAt?: string;
  claimExpiresAt?: string;
  generationKey?: string;
  sessionId?: string;
  notionPageId?: string;
}
```

Topics belong to the plan aggregate conceptually but are persisted as database rows so the app can query and claim them efficiently. Progression validation checks ordering, prerequisites, scenario diversity, and a gradual difficulty curve; it does not enforce a simplistic one-topic-per-technology rule.

### StudySession aggregate

Large text is rendered as Notion page blocks, while compact summaries and workflow fields are database properties.

```ts
type GenerationStage =
  | 'CLAIMED' | 'KNOWLEDGE_READY' | 'CONTENT_READY' | 'SCRIPT_READY'
  | 'AUDIO_GENERATING' | 'AUDIO_READY' | 'NOTION_FINALIZED' | 'COMPLETED'
  | 'FAILED';
type NotificationStatus = 'NOT_PENDING' | 'PENDING' | 'SENT' | 'FAILED';

interface StudySession {
  id: string;
  generationKey: string;
  studyPlanId: string;
  topicId: string;
  title: string;
  slug: string;
  week: number;
  sequenceInWeek: number;
  scenarioSummary: string;
  coveredConcepts: string[];
  researchSources: TopicResearchSource[];
  content?: StudyContent;
  interviewScript?: InterviewScript;
  audio?: AudioArtifact;
  stage: GenerationStage;
  lastSuccessfulStage: Exclude<GenerationStage, 'FAILED'>;
  failedStage?: GenerationStage;
  failureCode?: string;
  failureMessage?: string; // sanitized
  attemptsByStage: Record<string, number>;
  notificationStatus: NotificationStatus;
  generationModels: ModelUsage[];
  contentPromptVersion?: string;
  podcastPromptVersion?: string;
  validationPromptVersion?: string;
  notionPageId?: string;
  notionUrl?: string;
  createdAt: string;
  completedAt?: string;
  updatedAt: string;
}
```

`StudyContent` is structured, not one opaque string: overview, business context, requirements, assumptions, architecture, evolution steps, APIs, data ownership, decisions, failure scenarios, observability, SLI/SLOs, delivery, trade-offs, ASCII diagrams, mistakes, vocabulary, review questions, and optional challenge. Sections may be empty only when the scenario makes them irrelevant, with an explanation. `InterviewScript` contains ordered `{ speaker, text }` turns and estimated duration. `AudioArtifact` contains storage key, public URL, MIME type, bytes, duration if available, checksum, segments, and TTS model/voice metadata.

### State-transition policy

Only explicit transitions are legal. `FAILED` is a diagnostic overlay: `lastSuccessfulStage` remains the resume point. A retry clears failure metadata and enters the next incomplete stage. Completed artifacts are never regenerated unless an operator explicitly requests a future force-regeneration operation.

```text
CLAIMED -> KNOWLEDGE_READY -> CONTENT_READY -> SCRIPT_READY
        -> AUDIO_GENERATING -> AUDIO_READY -> NOTION_FINALIZED -> COMPLETED
                       any stage -> FAILED -> resume after lastSuccessfulStage
```

Notification has an independent state because Discord failure must not roll back or fail a completed episode.

## 5. Repository and service ports

```ts
interface StudyPlanRepository {
  createWithTopics(plan: StudyPlan, topics: StudyPlanTopic[]): Promise<void>;
  findById(id: string): Promise<StudyPlan | null>;
  findAll(): Promise<StudyPlan[]>;
  findActive(): Promise<StudyPlan[]>;
}

interface StudyTopicRepository {
  findPlannedInOrder(planId: string): Promise<StudyPlanTopic[]>;
  findHistorySummaries(planId: string): Promise<TopicHistorySummary[]>;
  existsBySlug(planId: string, slug: string): Promise<boolean>;
  tryClaim(topicId: string, claim: TopicClaim): Promise<ClaimResult>;
  save(topic: StudyPlanTopic): Promise<void>;
}

interface StudySessionRepository {
  create(session: StudySession): Promise<void>;
  findById(id: string): Promise<StudySession | null>;
  findByGenerationKey(key: string): Promise<StudySession | null>;
  findByPlan(planId: string): Promise<StudySession[]>;
  saveCheckpoint(session: StudySession, renderedBlocks?: NotionBlocks): Promise<void>;
}
```

Separate query ports can be added if API read requirements diverge. Notion implementations translate SDK pagination, property names, rich-text limits, and blocks through dedicated mappers. Domain code receives no SDK response objects.

AI ports are operation-specific (`StudyPlanGenerator`, `StudyContentGenerator`, `TopicDuplicateValidator`, `PodcastScriptGenerator`), preventing a generic “ask AI” service from leaking prompts into business logic. `WebResearcher`, `AudioGenerator`, `AudioStorage`, `AudioComposer`, and `SessionNotifier` complete the external ports.

## 6. Notion information architecture

### Hybrid databases plus nested pages (recommended)

1. **Study Plans database**: one row/page per plan. Properties: application ID, title, status, goal, level, dates, duration, frequency, preferred days, current week, progress, created/updated timestamps, and schema version.
2. **Topics & Sessions database**: one row/page per roadmap topic, with a session relation once generation starts. Properties include application topic/session IDs, plan relation, week/sequence, slug, status/stage, tags, short summary, covered-concepts summary, generation key, claim fields, model and prompt versions, audio URL/status, notification status, failure code, timestamps, and schema version.
3. The plan database page contains **Overview**, **Study Roadmap**, and child pages named `Week 01`, `Week 02`, etc. Week pages link to the canonical topic/session database pages. The canonical episode page holds the full readable content, avoiding duplicated bodies.

The requested hierarchy therefore appears naturally in Notion while database relations and filters remain queryable. Pure nested pages are pleasant to browse but poor for reliable selection/history queries. Pure databases are easy to query but make the roadmap less comfortable to navigate. The hybrid adds synchronization work for links and rollups, so link creation is idempotent and treated as presentation rather than truth.

Episode page block order:

1. Overview and generation status
2. Business Context
3. System Requirements and Assumptions
4. Architecture and ASCII diagrams (code blocks)
5. Architecture Evolution and Decisions
6. APIs, Data Ownership, and Communication
7. Consistency, Concurrency, Reliability, and Scaling (as relevant)
8. Failure Scenarios and Production Incidents
9. Observability and SLI/SLO
10. CI/CD and Deployment
11. Trade-offs and Common Mistakes
12. Interview Vocabulary and Review Questions
13. Full Study Content
14. Podcast Interview Script
15. Audio (public hyperlink; Notion external file/embed only if supported and stable)
16. Generation Metadata and cited web-research sources

Notion has property/block size and request limits. Render long content into bounded rich-text block chunks, batch append operations, paginate all queries, and use bounded rate-limit retries. The repository verifies configured database properties on startup or via a setup command and fails fast with actionable schema differences.

## 7. Configuration and model routing

Validate environment values at startup with Zod. `AiModelConfig` is injected and maps operations to model IDs:

```ts
interface AiModelConfig {
  planning: string;
  content: string;
  validation: string;
  podcastScript: string; // defaults to content model, independently overridable
  tts: string;
}
```

No generator owns a literal model name. Each call records operation, configured model, prompt version, OpenAI request ID when available, token usage, latency, and attempt. Suggested `.env.example`:

```dotenv
PORT=3000
NODE_ENV=development
LOG_LEVEL=info

STUDY_PLAN_CREATE_TOKEN=
GENERATION_API_TOKEN=                 # may initially equal create token

OPENAI_API_KEY=
OPENAI_CONTENT_MODEL=gpt-5.5
OPENAI_PLANNING_MODEL=gpt-5.5
OPENAI_VALIDATION_MODEL=gpt-5.5
OPENAI_SCRIPT_MODEL=gpt-5.5
OPENAI_TTS_MODEL=gpt-4o-mini-tts

NOTION_API_KEY=
NOTION_PARENT_PAGE_ID=

DISCORD_WEBHOOK_URL=

PODCAST_CRON=0 12 * * 2,5
PODCAST_TIMEZONE=America/Sao_Paulo
PODCAST_TARGET_MINUTES=30
SESSION_CLAIM_TTL_MINUTES=120

AUDIO_STORAGE_PATH=./storage/podcasts
AUDIO_PUBLIC_BASE_URL=https://example.com/audio
AUDIO_DOWNLOAD_TOKEN=                # optional MVP protection
```

Secrets are redacted centrally; configuration objects, request query strings, webhook URLs, and OpenAI/Notion headers must never be logged. Production should inject secrets through the deployment platform rather than an `.env` file.

## 8. Current web research

Before technical content is generated, the content model must use the Responses API web-search tool. Research prioritizes official documentation, standards, original papers, books, and first-party engineering publications. The structured result stores a concise summary, key concepts, and the canonical title, URL, publisher, and type of every source.

Web search is required for the research operation. Returned sources must come from the tool results and directly support the research; the model must not guess or reconstruct URLs from memory. The same persisted research object is the factual foundation for both the article and podcast so retries remain reproducible.

## 9. Plan generation

### API

`POST /study-plans/generate?token=...` accepts a DTO containing title, goal, duration, sessions per week, English level, preferred days, and optional start date/focus tags. `StudyPlanCreationTokenGuard` performs constant-time comparison against `STUDY_PLAN_CREATE_TOKEN`. Query authentication is an explicit MVP requirement, isolated so it can later become an API-key/header or user-auth guard. Disable access logs containing raw query strings and discourage copied URLs because proxies/browser histories can retain them.

### Flow

1. Validate DTO bounds and calculate dates/session count.
2. Build prompt version `study-plan.v1`, requiring scenario-led projects, prerequisites, learning objectives, tags, depth delta, and a foundational-to-advanced narrative.
3. Call the Responses API with Structured Outputs matching a Zod-derived JSON schema.
5. Locally validate count, unique sequences/slugs, preferred-day consistency, prerequisites, coherent difficulty progression, concrete production scenarios, and English output.
6. Permit at most a small bounded corrective regeneration (for example two attempts), supplying validation issues. Never loop indefinitely.
7. Create application IDs and persist plan/topics through an orchestration repository method. Because Notion lacks transactions, use a `DRAFT` plan, create topics/pages idempotently, then activate only after verification; a cleanup/resume operation repairs incomplete drafts.
8. Return `201` with IDs, status, and Notion URL; do not wait for an episode.

The response schema should contain roadmap rationale and a weekly array whose topics include scenario, goals, prerequisites, difficulty, tags, and continuity from earlier weeks. This makes “24 unrelated topics” structurally and semantically detectable.

## 10. Topic selection and layered duplicate prevention

The selector loads planned topics in absolute sequence and concise history fields only. It normally chooses the earliest eligible topic whose prerequisites are ready. AI refinement may sharpen constraints (for example, turn “Kafka pipeline” into recovery under downstream saturation) but cannot replace the core scenario without updating the roadmap record and rationale.

1. **Deterministic:** Unicode normalize, lowercase, strip punctuation, collapse whitespace, remove only safe display noise, and generate a stable slug. Reject an existing plan slug or normalized title.
2. **Concept overlap:** compare normalized major tags and history summaries. A high Jaccard/weighted overlap is a review signal, not an automatic rejection. Evaluate `depthDelta`, week distance, changed failure mode/scale/decision, and learning objectives so deliberate progression remains possible.
3. **AI semantic validation:** send the compact candidate plus previous titles, scenario summaries, concepts, and depth deltas—not full articles—to the validation model. Structured result:

```ts
{
  classification: 'NEW' | 'RELATED_BUT_DEEPER' | 'DUPLICATE';
  confidence: number;
  overlappingSessionIds: string[];
  rationale: string;
  suggestedDifferentiation?: string;
}
```

`NEW` proceeds. `RELATED_BUT_DEEPER` proceeds only with an explicit credible depth delta saved in metadata. `DUPLICATE` causes selection of the next eligible planned topic or one bounded refinement attempt. Exhaustion produces a reviewable failure; it never creates arbitrary content or retries indefinitely. Deterministic checks are repeated after refinement.

## 11. Stateful session-generation pipeline

`GenerateNextStudySessionUseCase(planId, triggerContext)` is shared by cron and manual API. It delegates retries to the same resumable stage runner:

1. Calculate deterministic `generationKey = planId:topicId` (and record scheduled local date/slot separately).
2. Return the existing session if that key is completed or in progress; otherwise claim the topic and create a `CLAIMED` session before expensive calls.
3. Run required web research and checkpoint its structured sources.
4. Generate and Zod-validate structured technical content in English; render and checkpoint the draft in Notion as `CONTENT_READY`.
5. Generate the interview script separately; validate speakers, self-contained language, duration/word target, forbidden meta-phrases, turn lengths, and topic coverage; checkpoint `SCRIPT_READY`.
6. Mark `AUDIO_GENERATING`, synthesize resumable segments to temporary keys, compose and atomically publish the final audio, then checkpoint `AUDIO_READY`.
7. Render/update all final Notion sections and audio link idempotently; checkpoint `NOTION_FINALIZED`.
8. Mark session/topic `COMPLETED`/`READY`, then set notification `PENDING` and send Discord. Mark `SENT` on success or `FAILED` on exhausted notification retries without changing session completion.

Every stage first checks whether its output already exists and is valid. Each checkpoint stores `lastSuccessfulStage`, attempt count, prompt/model versions, research sources, and artifact checksum. Writes use stable block markers or replace a known section so retrying does not append duplicate page sections. Failures store a safe code/message and the failed stage.

### Content and script prompt contracts

Prompts live in typed builders and export immutable versions such as `study-session.v1` and `podcast-script.v1`. The content builder requests a single production use case and conditionally applicable engineering concerns; it explicitly says not to inject Kafka, caching, or microservices without justification. It requests business context, requirements, evolution, architecture/ASCII diagrams, APIs/data ownership, correctness/reliability/scaling, observability/SLO, delivery, incidents, decisions/trade-offs, mistakes, vocabulary, questions, and a challenge.

The script builder receives the validated structured content (possibly compacted section-by-section), target duration, English level, and conversational rules. It requests `INTERVIEWER` and `CANDIDATE` turns, optional opening/closing `HOST`, progressive constraint revelation, clarification questions, challenges, concise spoken responses, reconsideration, monitoring and rollback discussion, and no document/lesson/prompt references. For a configurable 20–40 minute target, use a configurable words-per-minute estimate and schema bounds; treat the estimate as approximate, then optionally measure final audio duration.

## 12. Scheduling, idempotency, and concurrency

`PodcastScheduler` uses `@Cron(config.cron, { timeZone: config.timezone })`, creates a correlation/generation ID, finds active plans whose preferred day/next slot is due, and invokes the use case. It contains no selection or generation logic. Validate the IANA timezone and cron expression at startup. Record the resolved scheduled slot so DST behavior and missed runs are auditable.

### Acceptable Notion-only MVP claim

- Deploy exactly one scheduler-enabled replica (`SCHEDULER_ENABLED=true` on only one instance).
- Before work, query by unique deterministic generation key. Create the session claim immediately with claimant UUID, claimed/expires timestamps, and `CLAIMED` status; then read it back and proceed only if this claimant owns it.
- Use stable application IDs/generation keys and recheck both topic/session after each create. A stale claim can be reclaimed only after TTL and only if no newer successful checkpoint exists.
- If a race still creates duplicate Notion rows, deterministic keys make it detectable; choose the earliest canonical row, mark the other `SKIPPED_DUPLICATE`, and never perform expensive work from it.

This is best-effort, not a strong lock: Notion does not expose unique constraints, conditional writes, or atomic compare-and-swap, so simultaneous instances can both believe they claimed a topic. The single scheduler replica is therefore an operating requirement, not merely an optimization.

### Stronger future strategy

Introduce a small transactional coordination store or managed queue: PostgreSQL advisory/row locks with a unique `generation_key`, DynamoDB conditional put, Redis `SET NX` with careful lease ownership, or a queue with deduplication. Keep Notion as documentation/history and implement `GenerationLease` behind a port. For production multi-replica reliability, PostgreSQL plus an outbox/job worker is the clearest general solution; it is intentionally deferred until needed.

## 13. Audio generation, composition, and publication

`PodcastScriptGenerator` produces structured speaker turns. `TtsChunker` groups complete turns while observing the current Speech API input ceiling with a conservative configurable character/token budget. It never splits inside a sentence or speaker turn; if one turn exceeds the budget, a sentence-aware splitter creates continuation turns and rejects an indivisible oversized sentence with a validation error.

Voice mapping is configuration-backed (for example interviewer and candidate use distinct supported voices; host may reuse interviewer). Build chunks by adjacent speaker so each OpenAI Speech request uses one voice. Preserve `{turnIndex, segmentIndex}` ordering. Store each segment under a deterministic key including session, script checksum, voice, and index, so retries reuse completed segments.

`OpenAiAudioGenerator` returns encoded segments. `AudioComposer` should use an installed, pinned `ffmpeg` runtime to normalize codec/sample rate/loudness, add a short configurable pause between turns, and concatenate to a final MP3 without corrupting headers. If avoiding ffmpeg is essential, request a concatenation-safe format and compose carefully, but ffmpeg is the more dependable MVP choice. Test the runtime during health/startup checks.

`AudioStorage` provides `put`, `exists`, `getPublicUrl`, and `deleteTemporary`. `LocalAudioStorage` writes a temporary file, fsyncs where appropriate, and atomically renames it under `storage/podcasts/{planId}/{sessionId}.mp3`. Mount this path as a persistent volume.

Notion and Discord cannot access a container-only path. The simplest safe MVP options are:

1. expose `GET /audio/:sessionId/:opaqueFileToken` behind HTTPS, validate the unguessable token (or signed query with expiry), stream with correct content headers/range support, and set `AUDIO_PUBLIC_BASE_URL`; or
2. use S3-compatible object storage with signed or public-read URLs if the deployment has no durable/public disk.

Long-lived Notion links conflict with short-lived signed URLs. Prefer an application download URL with an opaque per-artifact token that can redirect to a renewed object-store URL later. Do not expose arbitrary filesystem paths. Object storage becomes recommended as soon as the app is horizontally scaled.

## 14. HTTP API

| Method and path | Purpose | Protection |
|---|---|---|
| `POST /study-plans/generate?token=...` | Generate and persist a roadmap | creation-token guard |
| `GET /study-plans` | Lightweight plan list | private deployment or read auth |
| `GET /study-plans/:id` | Plan and roadmap summary | private deployment or read auth |
| `POST /study-plans/:id/generate-next?token=...` | Invoke the same scheduled use case | generation-token guard |
| `GET /study-plans/:id/sessions` | Session summaries/stages | private deployment or read auth |
| `GET /sessions/:id` | Session metadata and links | private deployment or read auth |
| `POST /sessions/:id/retry?token=...` | Resume failed stage only | generation-token guard |
| `GET /audio/:sessionId/:token` | Stream a published artifact | opaque artifact token |
| `GET /health/live`, `GET /health/ready` | Process/dependency readiness | deployment policy |

Return DTOs, not domain objects or Notion records. Use `202 Accepted` for a manual generation that may continue asynchronously only after a worker exists; while the MVP executes inline, return `200/201` on completion and document proxy timeouts. A pragmatic early improvement is an in-process background runner returning `202`, but jobs are lost on restart; the persisted claim/checkpoint lets the next scheduler/retry resume them.

## 15. Error handling and retry policy

Classify errors centrally:

- **Retryable infrastructure:** OpenAI 429/5xx/timeouts, Notion 429/5xx, Discord 429/5xx, transient filesystem/process errors. Use exponential backoff with jitter, service-aware `Retry-After`, strict attempt caps, and per-call timeouts.
- **Non-retryable input/semantic:** DTO errors, Structured Output schema violation after bounded repair, duplicate classification, invalid state transition, missing or invalid required web-research source. Persist a clear operator-facing code.
- **Stage failure:** content/script/audio failures leave prior checkpoints intact. Audio retries resume missing segments. Notion finalization retries do not regenerate AI artifacts.
- **Notification failure:** retry independently (for example three immediate bounded attempts, then on later scheduler reconciliation); session remains completed.

Do not retry semantic regeneration indefinitely. Suggested defaults are three infrastructure attempts and at most two AI repair/refinement attempts. Add reconciliation on scheduler startup/run: resume non-expired failed/recoverable sessions and notifications according to policy before claiming new work, with a per-run cap.

## 16. Discord delivery

On `COMPLETED`, send one webhook message keyed logically by session ID:

```text
🎧 New Backend Study Session Ready

High-Scale Marketplace Recommendation Pipeline
Week 04 · Session 02

📖 Read: <notion-url>
🎙 Podcast: <audio-url>

Focus: Kafka · Backpressure · Caching · SLOs
```

Discord webhooks offer no application-level exactly-once guarantee. Persist `PENDING` before sending and `SENT` after. A crash between delivery and checkpoint can duplicate a message; accept this in the MVP, include the stable session ID in footer/content, and allow manual reconciliation. Future queue/outbox integration provides stronger delivery tracking. An optional failure webhook contains only session ID, failed stage, safe error code, and operator link—never prompt content or secrets.

## 17. Logging, observability, and security

Use NestJS-compatible structured JSON logging (for example Pino) with a request/correlation ID propagated to use cases and adapter calls. Bind `generationId`, `studyPlanId`, `topicId`, `sessionId`, `stage`, `model`, and `attempt`. Log stage transitions and durations, not full prompts, generated articles/scripts, source contents, tokens, SDK headers, webhook URLs, or query strings.

Conceptual metrics (logs initially, a metrics backend later):

- `study_session_generation_duration_seconds` by outcome
- `openai_generation_duration_seconds` by operation/model
- `tts_generation_duration_seconds` and segment count
- `generation_failures_total` by stage/code
- `duplicate_topics_rejected_total` by layer
- `notion_requests_total` by operation/status
- `discord_notification_failures_total`
- active/stale claims and stage age

Add liveness plus readiness checks for configuration, writable audio directory, ffmpeg, and optionally lightweight Notion access. Do not make OpenAI generation calls from readiness. Apply request validation/size limits, rate limiting to generation endpoints, HTTPS, least-privilege Notion integration access, safe filenames, and dependency/security scanning. Rotate the query token if it appears in logs/history.

## 18. Testing strategy

### Unit tests

- Unicode title normalization, slug stability, tag overlap, depth-delta rules, and all duplicate outcomes.
- Plan counts, week/sequence ordering, prerequisite/progression validation, and date/timezone slot calculation.
- State-machine allowed/forbidden transitions, failure overlay, checkpoint idempotency, and retry resume point.
- Web-research tool requirement, authoritative-source prompt contract, and structured source validation.
- Prompt snapshots/contracts and Zod schemas; assert model selection is injected, versions are recorded, English/meta-phrase requirements are present.
- Speaker-turn parsing, sentence/turn-safe chunking at boundaries, voice order, deterministic segment keys, and composer manifests.
- Notion mappers/block chunking and secret redaction.

### Integration and contract tests

Use Nest testing modules with fake ports for OpenAI, Notion repositories, Discord, clock/IDs, audio generator/composer/storage. Test the complete cron-to-notification path and manual endpoint equivalence. Contract-test Notion mappers against captured minimal fixtures and OpenAI Structured Output schemas without live billable calls in normal CI.

Critical partial failures:

- content succeeds and persists, TTS fails, then retry begins after `SCRIPT_READY` and does not call content/script generators;
- segment N fails, then retry reuses segments 0..N-1;
- Notion final update fails after final MP3 exists, then retry reuses audio;
- Discord fails, session remains completed and notification remains retryable;
- duplicate validator returns each classification and exhausts alternatives safely;
- two invocations share a generation key; only the canonical claim proceeds in the fake atomic repository;
- stale claim recovery, DST boundary, Notion pagination/rate limit, invalid structured response, and invalid research-source handling.

Add a small end-to-end smoke test using a temporary filesystem and in-memory/fake adapters. Live OpenAI/Notion/Discord tests are opt-in, tagged, budget-limited, and never required for pull requests.

## 19. Incremental delivery plan

Each phase should be independently reviewable and leave tests green.

### Phase 0 — scaffold and architectural guardrails

- Initialize NestJS strict TypeScript, formatting/linting/test tooling, validated configuration, redacting structured logger, health endpoints, `.env.example`, ignored storage.
- Establish domain/application/infrastructure folders and injection tokens. Add an architecture decision record for Notion-only persistence and single scheduler replica.
- Exit: app boots with validated config; unit/CI checks run without external credentials.

### Phase 1 — domain and fake persistence

- Implement entities/value objects, topic normalization, progression rules, stage machine, repository ports, clock/ID abstractions, and in-memory fakes.
- Exit: exhaustive domain transition/idempotency tests pass.

### Phase 2 — web research and prompts

- Implement required web search, structured research sources, typed/versioned prompt builders, schemas, and model routing.
- Exit: tool-call tests and prompt/schema tests demonstrate current, source-backed research.

### Phase 3 — study-plan generation

- Add OpenAI Responses adapter, plan generator Structured Output schema, use case, token guard/controller, corrective validation, and fake-repository integration tests.
- Exit: a coherent plan can be generated with a fake AI and invalid progression is rejected/repaired within bounds.

### Phase 4 — Notion persistence and hierarchy

- Implement client wrapper, schema verifier, mappers, repositories, page/block renderers, pagination/rate-limit policy, draft-to-active plan write, and roadmap/week links.
- Exit: opt-in sandbox test creates and re-reads a plan; retries do not duplicate records/sections.

### Phase 5 — selection, duplicates, and content

- Implement next-topic policy, layered duplicate validator, claims/generation key, structured content generator, session use case through `CONTENT_READY`, and Notion draft rendering.
- Exit: deterministic/semantic outcomes and competing invocation behavior are tested.

### Phase 6 — conversational script

- Implement separate script schema/prompt/generator, duration estimate, forbidden-reference validation, and checkpoint.
- Exit: fixtures produce ordered, self-contained B2–C1 turns with natural challenges.

### Phase 7 — audio and public delivery

- Implement turn-safe chunker, speaker voice mapping, Speech adapter, deterministic segment cache, ffmpeg composer, local storage, secure streaming route/range support, and final page audio link.
- Exit: fake TTS verifies order/resume; an opt-in short live sample produces a playable MP3 and accessible URL.

### Phase 8 — scheduler, retry, and Discord

- Add thin configured cron, manual generate/retry endpoints, startup reconciliation, notification state/retries, and full orchestration integration tests.
- Exit: cron-to-completion works; every injected stage failure resumes without repeating completed expensive work.

### Phase 9 — production hardening

- Add deployment manifest with persistent volume/single scheduler replica, timeouts, graceful shutdown between checkpoints, rate limits, metrics export, backup/export procedure, runbook, dependency scanning, and cost/retention limits.
- Run a multi-week dry run with reduced audio duration; inspect repetition, content quality, Notion navigation, costs, and alert noise.
- Exit: operational checklist and recovery drill are complete before enabling the full cron.

## 20. Key risks and explicit trade-offs

| Risk | MVP mitigation | Evolution trigger |
|---|---|---|
| Notion race/partial writes | one scheduler replica, deterministic keys, claims, draft states, reconciliation | multiple workers or duplicate occurrence -> transactional coordinator |
| Long request/runtime crash | stage checkpoints and resumable artifacts | higher volume -> durable queue/worker |
| Notion API limits/large content | block batching, compact properties, backoff | poor authoring/query performance -> app DB plus Notion projection |
| Local audio durability/access | persistent volume and opaque HTTPS route | horizontal/ephemeral deployment -> object storage |
| TTS length/cost | configurable duration, turn-safe chunks, cached segments | cost/quality requirements -> stronger TTS/mixing pipeline |
| AI repetition/hallucination | roadmap, three-layer duplicate check, schemas, source refs, bounded repair | corpus growth -> hybrid semantic retrieval/evaluation suite |
| Query-string secret leakage | isolated guard, no query logging, HTTPS, rotation | next auth iteration -> header/API key or identity provider |

This plan keeps the first build small enough to operate personally while preserving the seams—repositories, operation-specific AI ports, generation leases, web research, audio storage, and notifications—needed to replace MVP infrastructure without rewriting the domain workflow.
