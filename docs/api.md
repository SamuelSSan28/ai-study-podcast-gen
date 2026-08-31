# API Reference

The API is available at `http://localhost:3000` by default. All endpoints are
protected by the global token guard and require the query parameter
`?token=<STUDY_PLAN_CREATE_TOKEN>`. Requests with a missing or invalid token receive
an HTTP `401 Unauthorized` response.

**Web dashboard:** open `http://localhost:3000/` after `npm run start:dev` (same token).

For a step-by-step local workflow with copy-paste curl commands, see
[`curl-examples.md`](curl-examples.md).

## Endpoints

| Method   | Route                                                      | Description                         |
| -------- | ---------------------------------------------------------- | ----------------------------------- |
| `POST`   | `/study-plans?token=...`                                   | Accept a new curriculum (async)     |
| `GET`    | `/study-plans/:id/status?token=...`                        | Provisioning lifecycle status       |
| `GET`    | `/study-plans?token=...`                                   | List roadmaps                       |
| `GET`    | `/study-plans/:id?token=...`                               | Get a roadmap                       |
| `GET`    | `/study-plans/:id/topics?token=...`                        | List scheduled topics (SQLite)      |
| `DELETE` | `/study-plans/:id?token=...`                               | Remove roadmap (SQLite + Notion)    |
| `PATCH`  | `/study-plans/:planId/topics/:topicId/studied?token=...`   | Mark topic studied (local)          |
| `POST`   | `/study-plans/:id/generate-next?token=...&mode=DISCUSSION` | Queue next session (`202`)          |
| `GET`    | `/study-plans/:id/sessions?token=...`                      | List sessions for a roadmap         |
| `GET`    | `/sessions/:id?token=...`                                  | Get a session                       |
| `POST`   | `/sessions/:id/retry?token=...`                            | Queue retry (`202`)                 |
| `GET`    | `/audio/:sessionId?token=...`                              | Stream a generated MP3              |

## Create a roadmap (async)

`POST /study-plans` accepts the request immediately and enqueues plan + first-session
generation via BullMQ.

**New request — `202 Accepted`**

```json
{
  "id": "uuid",
  "title": "Event-Driven Architecture",
  "goal": "Design and discuss production event-driven architectures…",
  "status": "PROCESSING"
}
```

**Duplicate or in-flight request — `200 OK`**

```json
{
  "id": "uuid",
  "status": "PROCESSING"
}
```

### Idempotency

Send an optional `Idempotency-Key` header. When omitted, the server derives a key from
`sha256(normalize(title) + '|' + normalize(goal))`.

## Provisioning status

Poll `GET /study-plans/:id/status` until the plan is ready:

| Status       | Meaning                                              |
| ------------ | ---------------------------------------------------- |
| `CREATING`   | AI curriculum and 18 topics are being generated      |
| `GENERATING` | Plan is active; first session pipeline is running    |
| `READY`      | Plan and first session generation finished           |
| `FAILED`     | Plan or first-session generation failed              |

## Mark topic as studied

Progress is tracked locally in SQLite (not synced from Notion):

```bash
curl -X PATCH \
  'http://localhost:3000/study-plans/<plan-id>/topics/<topic-id>/studied?token=change-me' \
  -H 'Content-Type: application/json' \
  -d '{"studied": true}'
```

When the topic is `READY`, this enqueues generation of the next episode. A cron job also
checks every 12 hours (`LOCAL_PROGRESS_CRON`).

## Generate the next episode

Returns `202 Accepted` with `{ "status": "QUEUED", "jobId": "...", "planId": "..." }`.

```bash
curl -X POST \
  'http://localhost:3000/study-plans/<roadmap-id>/generate-next?token=change-me&mode=DISCUSSION'
```

## Retry a failed generation

Returns `202 Accepted`.

```bash
curl -X POST \
  'http://localhost:3000/sessions/<session-id>/retry?token=change-me'
```

## Delete a roadmap

```bash
curl -X DELETE \
  'http://localhost:3000/study-plans/<roadmap-id>?token=change-me'
```

Returns `204 No Content`.
