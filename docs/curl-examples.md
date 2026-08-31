# Exemplos de curl — gerar roadmap e episódios

Guia prático para testar a API localmente. A referência completa dos endpoints está em [`api.md`](api.md).

**Dashboard web:** com o servidor rodando, abra `http://localhost:3000/` e informe o mesmo token do `.env`.

## Pré-requisitos

1. Copie e preencha o `.env` (inclui `DATABASE_URL`, `REDIS_URL`):

```bash
cp .env.example .env
mkdir -p data
npm run db:migrate
```

2. Suba **Redis** e o app (local ou Docker):

```bash
# opção A — Docker (Redis + app)
docker compose up --build

# opção B — local (Redis deve estar rodando em 6379)
npm run start:dev
```

```bash
export BASE_URL=http://localhost:3000
export TOKEN=dev-local-token
 
```

> Todos os endpoints exigem `?token=...`. Token inválido ou ausente retorna `401 Unauthorized`.

---

## Fluxo completo (do zero ao áudio)

### 1. Criar um roadmap (aceita na hora, geração async)

O `POST /study-plans` retorna **202** imediatamente com `status: "PROCESSING"` e enfileira a geração do plano + 1º episódio. Use `GET /study-plans/:id/status` para acompanhar.

```bash
curl -s -X POST "${BASE_URL}/study-plans?token=${TOKEN}" \
  -H 'Content-Type: application/json' \
  -d '{
    "title": "Event-Driven Architecture",
    "goal": "Projetar e discutir arquiteturas event-driven em entrevistas de engenharia sênior"
  }' | jq .
```

Resposta típica (`201`):

```json
{
  "id": "…",
  "title": "Event-Driven Architecture",
  "goal": "Projetar e discutir…",
  "status": "CREATING"
}
```

**Idempotência** — envie `Idempotency-Key` ou deixe o servidor derivar a chave de `title+goal`. Se já existir plano `ACTIVE` com o mesmo goal (ou replay em andamento), retorna **200**:

```json
{ "id": "…", "status": "PROCESSING" }
```

```bash
curl -s -X POST "${BASE_URL}/study-plans?token=${TOKEN}" \
  -H 'Content-Type: application/json' \
  -H 'Idempotency-Key: meu-roadmap-kafka' \
  -d '{
    "title": "Event-Driven Architecture",
    "goal": "Projetar e discutir arquiteturas event-driven em entrevistas de engenharia sênior"
  }' | jq .
```

Com duração customizada (30–60 minutos por sessão):

```bash
curl -s -X POST "${BASE_URL}/study-plans?token=${TOKEN}" \
  -H 'Content-Type: application/json' \
  -d '{
    "title": "Kafka em Produção",
    "goal": "Operar clusters Kafka com confiabilidade e observabilidade",
    "settings": {
      "targetSessionMinutes": 30
    }
  }' | jq .
```

Guarde o `id` retornado:

```bash
export PLAN_ID="<id-do-json-acima>"
```

### 1b. Acompanhar status da geração

Poll até `READY` (ou tratar `FAILED`):

```bash
curl -s "${BASE_URL}/study-plans/${PLAN_ID}/status?token=${TOKEN}" | jq .
```

Valores possíveis: `CREATING` → `GENERATING` → `READY` | `FAILED`.

Exemplo de loop simples:

```bash
until STATUS=$(curl -s "${BASE_URL}/study-plans/${PLAN_ID}/status?token=${TOKEN}" | jq -r .status) \
  && [ "$STATUS" = "READY" -o "$STATUS" = "FAILED" ]; do
  echo "status=$STATUS — aguardando…"
  sleep 15
done
echo "final: $STATUS"
```

---

### 2. Listar roadmaps

```bash
curl -s "${BASE_URL}/study-plans?token=${TOKEN}" | jq .
```

---

### 3. Ver detalhes de um roadmap

```bash
curl -s "${BASE_URL}/study-plans/${PLAN_ID}?token=${TOKEN}" | jq .
```

---

### 3b. Listar tópicos agendados

```bash
curl -s "${BASE_URL}/study-plans/${PLAN_ID}/topics?token=${TOKEN}" | jq .
```

---

### 3c. Marcar tópico como estudado (SQLite local)

Dispara o progresso do roadmap quando o tópico já está `READY`:

```bash
export TOPIC_ID="<id-do-topico>"
curl -s -X PATCH \
  "${BASE_URL}/study-plans/${PLAN_ID}/topics/${TOPIC_ID}/studied?token=${TOKEN}" \
  -H 'Content-Type: application/json' \
  -d '{"studied": true}' | jq .
```

---

### 4. Listar sessões (episódios) de um roadmap

Útil para acompanhar o progresso e pegar o `session id`:

```bash
curl -s "${BASE_URL}/study-plans/${PLAN_ID}/sessions?token=${TOKEN}" | jq .
```

Campos importantes na resposta:

| Campo | Significado |
| --- | --- |
| `stage` | Estágio atual (`CONTENT_PENDING` → … → `COMPLETED`) |
| `audioUrl` | URL pública do MP3 (local ou Google Drive) |
| `notionUrl` | Página da sessão no Notion |
| `lastError` | Erro da última falha (se houver) |

```bash
export SESSION_ID="<id-da-sessao>"
```

---

### 5. Gerar o próximo episódio

Use depois de marcar um tópico como estudado (dashboard ou `PATCH .../studied`), ou para forçar a geração manual. Retorna `202` com job enfileirado.

**Modo discussão** (dois engenheiros conversando):

```bash
curl -s -X POST \
  "${BASE_URL}/study-plans/${PLAN_ID}/generate-next?token=${TOKEN}&mode=DISCUSSION" | jq .
```

**Modo entrevista** (entrevistador + candidato):

```bash
curl -s -X POST \
  "${BASE_URL}/study-plans/${PLAN_ID}/generate-next?token=${TOKEN}&mode=INTERVIEW" | jq .
```

Sem `mode`, usa o modo didático `EXPLANATION` (formato e extensão definidos pela IA conforme o tópico).

> A geração pode levar vários minutos (pesquisa, roteiro, TTS, composição de áudio). Consulte o endpoint de sessão para acompanhar o `stage`.

---

### 6. Consultar uma sessão específica

```bash
curl -s "${BASE_URL}/sessions/${SESSION_ID}?token=${TOKEN}" | jq .
```

Exemplo: ver só o estágio e a URL do áudio:

```bash
curl -s "${BASE_URL}/sessions/${SESSION_ID}?token=${TOKEN}" \
  | jq '{ id, title, stage, audioUrl, lastError, retryCount }'
```

Estágios do pipeline (em ordem):

```text
CONTENT_PENDING → CONTENT_READY → CONVERSATION_PLAN_READY → SCRIPT_READY
→ DIALOGUE_READY → AUDIO_READY → UPLOADED → COMPLETED
```

---

### 7. Retomar uma geração que falhou

Retoma a partir do último estágio bem-sucedido:

```bash
curl -s -X POST \
  "${BASE_URL}/sessions/${SESSION_ID}/retry?token=${TOKEN}" | jq .
```

---

### 8. Baixar / ouvir o MP3

Com storage local (`AUDIO_STORAGE_BACKEND=local`):

```bash
curl -s "${BASE_URL}/audio/${SESSION_ID}?token=${TOKEN}" \
  --output episodio.mp3
```

Ou abra no navegador:

```text
http://localhost:3000/audio/<session-id>?token=<seu-token>
```

Também funciona a URL em `audioUrl` retornada pela sessão.

---

### 9. Remover um roadmap

```bash
curl -s -X DELETE "${BASE_URL}/study-plans/${PLAN_ID}?token=${TOKEN}" -w "\nHTTP %{http_code}\n"
```

Retorna `204 No Content`.

---

## Script de smoke test (copiar e colar)

Roda o fluxo mínimo: cria plano → espera → consulta sessões.

```bash
#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3000}"
TOKEN="${TOKEN:-change-me}"

echo "→ Criando roadmap..."
PLAN_ID=$(curl -s -X POST "${BASE_URL}/study-plans?token=${TOKEN}" \
  -H 'Content-Type: application/json' \
  -d '{"title":"Smoke Test","goal":"Validar pipeline local"}' \
  | jq -r '.id')

echo "   plan id: ${PLAN_ID}"

echo "→ Aguardando 30s (primeira sessão em andamento)..."
sleep 30

echo "→ Sessões do plano:"
curl -s "${BASE_URL}/study-plans/${PLAN_ID}/sessions?token=${TOKEN}" \
  | jq '.[] | { id, title, stage, audioUrl }'
```

Salve como `scripts/smoke-curl.sh`, dê permissão de execução e rode:

```bash
chmod +x scripts/smoke-curl.sh
./scripts/smoke-curl.sh
```

---

## Erros comuns

| Sintoma | Causa provável | O que fazer |
| --- | --- | --- |
| `401 Unauthorized` | Token errado ou ausente | Confira `STUDY_PLAN_CREATE_TOKEN` no `.env` |
| `connection refused` na API | Servidor parado | `npm run start:dev` |
| Sessão presa em `CONTENT_PENDING` | OpenAI ou Notion com problema | `npm run check:integrations` |
| `404` no `/audio/...` | Geração ainda não terminou ou falhou | Consulte `stage` e `lastError` da sessão |
| Discord não recebeu mensagem | Webhook inválido | Valide `DISCORD_WEBHOOK_URL` no check de integrações |

---

## Referências

- [API Reference](api.md) — tabela de endpoints
- [Environment variables](environment.md) — variáveis do `.env`
- [`npm run check:integrations`](../scripts/check-integrations.ts) — validação rápida das integrações
