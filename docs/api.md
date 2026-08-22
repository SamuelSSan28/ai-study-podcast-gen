# API Reference

The API is available at `http://localhost:3000` by default. Routes that start or retry a generation require `?token=<STUDY_PLAN_CREATE_TOKEN>`.

## Endpoints

| Method | Route | Description |
| --- | --- | --- |
| `POST` | `/study-plans/generate?token=...` | Create a roadmap |
| `GET` | `/study-plans` | List roadmaps |
| `GET` | `/study-plans/:id` | Get a roadmap |
| `POST` | `/study-plans/:id/generate-next?token=...` | Generate the next session |
| `GET` | `/study-plans/:id/sessions` | List sessions for a roadmap |
| `GET` | `/sessions/:id` | Get a session |
| `POST` | `/sessions/:id/retry?token=...` | Resume a failed generation |
| `GET` | `/audio/:sessionId` | Stream a generated MP3 |

## Create a roadmap

```bash
curl -X POST 'http://localhost:3000/study-plans/generate?token=change-me' \
  -H 'Content-Type: application/json' \
  -d '{
    "title": "Event-driven order processing",
    "durationWeeks": 8,
    "sessionsPerWeek": 2,
    "level": "senior",
    "goal": "Understand when Kafka is a good fit for order processing, its trade-offs, and simpler alternatives",
    "preferredDays": ["TUESDAY", "FRIDAY"]
  }'
```

`preferredDays` accepts `MONDAY`, `TUESDAY`, `WEDNESDAY`, `THURSDAY`, `FRIDAY`, `SATURDAY`, and `SUNDAY`. An optional `startDate` string can also be provided.

## Generate the next episode

```bash
curl -X POST \
  'http://localhost:3000/study-plans/<roadmap-id>/generate-next?token=change-me'
```

## Retry a failed generation

```bash
curl -X POST \
  'http://localhost:3000/sessions/<session-id>/retry?token=change-me'
```
