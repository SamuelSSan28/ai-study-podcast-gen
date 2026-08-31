# OpenAI integration

This document describes how the project uses the **current OpenAI API** (Node.js SDK `openai@^5`, **Responses API**, Structured Outputs, web search, and Speech API). It maps each pipeline stage to the code, schemas, and environment variables involved.

## SDK and API surface

| Component | Version / API | Where |
|-----------|---------------|-------|
| Node SDK | `openai@^5.12.2` | `package.json` |
| Structured JSON | `client.responses.parse()` | `src/ai/openai.gateway.ts` |
| Schema helper | `zodTextFormat()` from `openai/helpers/zod` | same file |
| Web search | `tools: [{ type: 'web_search' }]` | `researchTopic()` |
| Text-to-speech | `client.audio.speech.create()` | `generateSpeech()` |
| Local validation | Zod schemas in `src/ai/schemas.ts` | parsed again after API response |

The gateway implements the `AiGateway` port (`src/application/ports.ts`). Use cases depend on the port, not on the OpenAI SDK directly.

## Configuration

Models are configured per operation via environment variables (see [environment.md](environment.md)):

| Operation | Env variable | Default |
|-----------|--------------|---------|
| Goal normalization | `AUX_MODEL` | `gpt-5.6-luna` |
| Study plan / roadmap | `ROADMAP_MODEL` | `gpt-5.6-terra` |
| Web research + article | `ARTICLE_MODEL` | `gpt-5.6-terra` |
| Duplicate classification | `AUX_MODEL` | `gpt-5.6-luna` |
| Conversation plan, script, polish | `SCRIPT_MODEL` | `gpt-5.6-terra` |
| TTS (local) | `TTS_PROVIDER=kokoro` | Kokoro-FastAPI |
| TTS (OpenAI fallback) | `OPENAI_TTS_MODEL` | `gpt-4o-mini-tts` |

On LLM failure the gateway retries once with the same model, then escalates to
`FALLBACK_MODEL` (default `gpt-5.6-sol`).

`AiModelConfig` (`src/config/ai-model.config.ts`) reads these values at runtime.
Legacy `OPENAI_*_MODEL` variables still work as fallbacks.

## Core pattern: Responses API + Structured Outputs

All LLM calls share a single private method:

```typescript
// src/ai/openai.gateway.ts
const response = await this.client.responses.parse({
  model,
  input,                                    // prompt string
  text: { format: zodTextFormat(schema, name) },
  ...(webSearch ? {
    tools: [{ type: 'web_search' }],
    tool_choice: 'required',
  } : {}),
});
return schema.parse(response.output_parsed);
```

Key points:

1. **`responses.parse`** — current Responses API entry point; returns `output_parsed` when using `zodTextFormat`.
2. **`zodTextFormat(schema, name)`** — converts a Zod schema into a strict JSON Schema for Structured Outputs.
3. **Double validation** — the SDK parses the response; the gateway runs `schema.parse()` again for safety.
4. **Token usage** — `response.usage?.input_tokens` / `output_tokens` are recorded by `RunTraceService` when eval tracing is enabled.

## Pipeline stages

```text
Title + Goal
  │
  ├─ generatePlan          → generatedPlanSchema     (planning model)
  │
  └─ per session topic:
       ├─ validateDuplicate → duplicateSchema         (validation model)
       ├─ researchTopic     → topicResearchSchema     (content model + web_search)
       ├─ generateContent   → contentSchema           (content model)
       ├─ createConversationPlan → mode-specific schema (conversation plan model)
       ├─ generateScript    → mode-specific schema    (script model)
       ├─ polishDialogue    → mode-specific schema    (polish model)
       └─ generateSpeech    → audio.speech.create     (TTS model, per turn)
```

### 1. Study plan (`generatePlan`)

- **Prompt:** `buildPlanPrompt()` in `src/ai/prompts/study-plan.prompt.ts`
- **Schema:** `generatedPlanSchema` — overview + array of topics with difficulty, objectives, prerequisites, etc.
- **Web search:** no

### 2. Duplicate check (`validateDuplicate`)

- **Input:** candidate topic + history summaries
- **Schema:** `duplicateSchema` — `classification: NEW | RELATED_BUT_DEEPER | DUPLICATE` + rationale
- **Web search:** no

### 3. Topic research (`researchTopic`)

- **Prompt:** instructs the model to use web search for authoritative, current sources
- **Schema:** `topicResearchSchema` — summary, key concepts, sources (title, URL, publisher, type)
- **Web search:** **required** (`tool_choice: 'required'`)
- **Post-processing:** invalid URLs (non-http/https) are filtered out before returning

### 4. Technical content (`generateContent`)

- **Prompt:** `buildContentPrompt()` — uses research output as context
- **Schema:** `contentSchema` — architecture, decisions, tradeoffs, review questions, etc.
- **Web search:** no (grounding comes from the research step)

### 5. Conversation plan (`createConversationPlan`)

- **Prompts:** mode-specific (`DISCUSSION` vs `INTERVIEW`) via `resolvePrompt()` in `src/ai/prompts/prompt.factory.ts`
- **Schemas:** `discussionConversationPlanSchema` or `interviewConversationPlanSchema`
- **Context:** includes prior-session summaries when available

### 6. Podcast script (`generateScript`)

- **Prompts:** mode-specific script prompts
- **Schemas:** `discussionScriptSchema` or `interviewScriptSchema`
- **Output:** raw script with turns, speakers, delivery hints

### 7. Dialogue polish (`polishDialogue`)

- **Prompts:** mode-specific polisher prompts
- **Output:** validated `PodcastScript` ready for TTS

### 8. Speech synthesis (`generateSpeech`)

Uses the **Speech API** (not Responses):

```typescript
await this.client.audio.speech.create({
  model: this.models.tts,
  voice,
  input: text,
  instructions,           // optional delivery hints from script
  response_format: 'mp3',
});
```

Audio bytes are saved locally via `LocalAudioService`. Voices are configured per mode in `.env` (see [environment.md](environment.md#voices)).

## Schemas reference

All Zod schemas live in `src/ai/schemas.ts`:

| Schema name | Used by | Top-level shape |
|-------------|---------|-----------------|
| `generatedPlanSchema` | `generatePlan` | `{ overview, topics[] }` |
| `topicResearchSchema` | `researchTopic` | `{ summary, keyConcepts, sources[] }` |
| `duplicateSchema` | `validateDuplicate` | `{ classification, rationale }` |
| `contentSchema` | `generateContent` | technical study material fields |
| `discussionConversationPlanSchema` | DISCUSSION plan | conversation structure |
| `interviewConversationPlanSchema` | INTERVIEW plan | interview structure |
| `discussionScriptSchema` / `interviewScriptSchema` | script generation | turns with speakers |
| polished variants | dialogue polish | final script with validation metadata |

Every schema used with `zodTextFormat` must be a **Zod object** at the top level (OpenAI Structured Outputs requirement).

## Observability

When eval tracing is active, `RunTraceService` records each OpenAI call:

```text
run_id, case_id, workflow_version
  → stages (timings)
  → openAiCalls: { model, name, inputTokens, outputTokens, webSearch }
  → duplicateChecks, validations
```

See `src/observability/run-trace.service.ts` and exported trajectories in `docs/evaluation/trajectories/`.

## Baseline comparison

The eval baseline (`src/eval/baseline-runner.ts`) also uses `responses.parse` + `zodTextFormat` with a single combined prompt/schema — one call instead of the multi-stage pipeline. This provides a fair API-level comparison against the orchestrated workflow.

## Testing without live API calls

Unit tests mock `client.responses.parse` and `client.audio.speech.create`:

- `test/openai-gateway.spec.ts` — verifies web search is required for research and sources are structured
- Other tests use fake `AiGateway` implementations via Nest testing modules

Run:

```bash
npm test -- openai-gateway
```

## Troubleshooting

| Symptom | Likely cause | Action |
|---------|--------------|--------|
| `Invalid schema for response_format` | Zod schema not a top-level object, or SDK/Zod version mismatch | Ensure schema is `z.object({...})`; project uses `zod@^3.25` with `openai@^5` |
| `OpenAI returned no parsed X output` | Model refused or malformed JSON | Check prompt; retry; inspect raw response in logs |
| Research returns empty sources | Web search unavailable or filtered | Verify model supports `web_search`; check URL filter in `researchTopic()` |
| High token usage | Large prompts (full content in script step) | Expected for long sessions; tune `PODCAST_MAX_TURNS` / `PODCAST_MAX_TURN_CHARACTERS` |
| TTS failures | Voice name invalid for model | Use voices supported by `OPENAI_TTS_MODEL` |

Verify credentials and external services:

```bash
npm run check:integrations
```

## Official OpenAI references

- [Responses API](https://platform.openai.com/docs/api-reference/responses)
- [Structured Outputs](https://platform.openai.com/docs/guides/structured-outputs)
- [Web search tool](https://platform.openai.com/docs/guides/tools-web-search)
- [Text to speech](https://platform.openai.com/docs/guides/text-to-speech)
- [Node.js SDK](https://github.com/openai/openai-node)
