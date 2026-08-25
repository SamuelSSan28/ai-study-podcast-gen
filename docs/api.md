# API Reference

The API is available at `http://localhost:3000` by default. All eight endpoints are
protected by the global token guard and require the query parameter
`?token=<STUDY_PLAN_CREATE_TOKEN>`. Requests with a missing or invalid token receive
an HTTP `401 Unauthorized` response.

## Endpoints

| Method | Route                                                      | Description                    |
| ------ | ---------------------------------------------------------- | ------------------------------ |
| `POST` | `/study-plans?token=...`                                   | Create an automatic curriculum |
| `GET`  | `/study-plans?token=...`                                   | List roadmaps                  |
| `GET`  | `/study-plans/:id?token=...`                               | Get a roadmap                  |
| `POST` | `/study-plans/:id/generate-next?token=...&mode=DISCUSSION` | Generate the next session      |
| `GET`  | `/study-plans/:id/sessions?token=...`                      | List sessions for a roadmap    |
| `GET`  | `/sessions/:id?token=...`                                  | Get a session                  |
| `POST` | `/sessions/:id/retry?token=...`                            | Resume a failed generation     |
| `GET`  | `/audio/:sessionId?token=...`                              | Stream a generated MP3         |

## Create a roadmap

```bash
curl -X POST 'http://localhost:3000/study-plans?token=change-me' \
  -H 'Content-Type: application/json' \
  -d '{
    "title": "Event-Driven Architecture",
    "goal": "Design and discuss production event-driven architectures in senior engineering interviews"
  }'
```

The service creates an 18-session progressive curriculum, schedules it for Monday,
Wednesday, and Friday, and generates only its first topic. An optional
`settings.targetSessionMinutes` value between 30 and 60 overrides the 45-minute default.

## Generate the next episode

```bash
curl -X POST \
  'http://localhost:3000/study-plans/<roadmap-id>/generate-next?token=change-me&mode=DISCUSSION'
```

`mode` accepts `DISCUSSION` for a peer-to-peer technical podcast or `INTERVIEW` for an
interviewer/candidate simulation. When omitted, the API uses `DEFAULT_PODCAST_MODE`.

## Retry a failed generation

```bash
curl -X POST \
  'http://localhost:3000/sessions/<session-id>/retry?token=change-me'
```
