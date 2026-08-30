# Video script (≤ 5 minutes)

## 0:00–0:40 — Problem + manual session work

"Preparing one technical study session is not one task. You research sources, synthesize notes, rewrite for audio, generate TTS, and track what you already covered — then do it again next week.

That coordination is the bottleneck, not finding content on Google."

## 0:40–1:15 — Baseline

"Our baseline is what most people actually do: one generic AI prompt for content plus script. We automated that degraded flow and scored it with the same rubric as the final system.

Baseline still needs five human orchestration steps — research, synthesis, scripting, audio, organization."

## 1:15–3:15 — Live end-to-end demo

Show:

1. Create study plan (title + goal) via API or Notion
2. Session pipeline stages in logs / Notion session record
3. Web research sources attached to session
4. Completed script validation
5. Audio link (Google Drive) + Discord notification

Keep focus on **workflow output**, not folder structure.

## 3:15–4:10 — Baseline vs final numbers

Open `evaluation/results/report.md`:

- Primary metric: avg rubric score
- Human steps: 5 → 0
- Grounding / validation subscores

"Same cases, same rubric, generated automatically during runs."

## 4:10–4:40 — Best experiment + something rejected

Best: web research stage — show grounding subscore delta with `--toggle=skip-web-research`.

Rejected: multi-agent wrapper — no measured improvement on our rubric.

## 4:40–5:00 — Failure mode + hot take

"Without validation before TTS, bad scripts waste the most expensive stage. Deterministic checks beat another LLM agent for that job."

Close: link to repo, `docs/hackathon/reproduction.md`, and trajectories.

---

## Recording checklist

- [ ] Screen capture: Notion roadmap + session status
- [ ] Screen capture: eval report markdown
- [ ] Audio sample ~15 seconds
- [ ] Discord notification screenshot (optional)
