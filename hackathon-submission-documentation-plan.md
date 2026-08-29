# Plano de documentação e submission — micro1 Agentic Workflows Hackathon

> Projeto: `SamuelSSan28/ai-study-podcast-gen`  
> Status: documento vivo. Ele define como preparar a submission sem transformar a narrativa em algo fixo antes dos testes.

## 1. Tese da submission

O projeto não deve ser vendido apenas como **“um gerador de podcast com IA”**. A narrativa deve partir do trabalho que uma pessoa faria manualmente para manter uma rotina de estudo técnico.

Um fluxo manual razoável é:

```text
Learning goal
  ↓
quebrar o objetivo em tópicos
  ↓
decidir ordem e pré-requisitos
  ↓
pesquisar fontes
  ↓
filtrar e sintetizar conteúdo
  ↓
preparar material de estudo
  ↓
adaptar para roteiro/áudio
  ↓
gerar e organizar áudio
  ↓
registrar progresso
  ↓
lembrar o que já foi estudado
  ↓
evitar repetição
  ↓
decidir a próxima sessão
  ↓
repetir tudo novamente
```

O produto tenta reduzir essa **orquestração manual repetitiva**:

```text
Title + Goal
  ↓
AI-assisted roadmap planning
  ↓
persisted roadmap + progress
  ↓
next-topic selection
  ↓
semantic duplicate check
  ↓
current web research
  ↓
technical content
  ↓
conversation planning with prior-session context
  ↓
script generation
  ↓
dialogue polishing + validation
  ↓
TTS + audio composition
  ↓
storage + notification
  ↓
progress informs the next run
```

Essa é uma **hipótese de valor**, não uma conclusão pronta. A versão final deve ser reescrita a partir do comportamento real do código e dos resultados medidos.

## 2. Problema e usuário

Formulação inicial possível:

> Software engineers and other self-directed technical learners often know what they want to learn, but repeatedly spend time deciding how to learn it, finding current sources, organizing material, producing study artifacts and keeping continuity across sessions.

O gargalo central não é “falta de conteúdo na internet”. É a necessidade de coordenar continuamente:

- planejamento;
- pesquisa;
- geração/síntese;
- consistência entre formatos;
- progresso;
- seleção da próxima sessão;
- prevenção de repetição;
- recuperação de falhas intermediárias.

A descrição final do usuário deve refletir os casos realmente avaliados.

## 3. O que o projeto já tem hoje

A narrativa pode se apoiar no que já existe no repositório:

- entrada de alto nível com `title` + `goal`;
- geração de roadmap progressivo;
- persistência de planos, tópicos e sessões;
- seleção da próxima sessão;
- validação semântica de duplicidade (`NEW`, `RELATED_BUT_DEEPER`, `DUPLICATE`);
- pesquisa atual via web search;
- geração de conteúdo técnico usando a pesquisa como contexto;
- conversation planning;
- contexto das sessões anteriores na nova sessão;
- geração de script;
- polishing separado;
- validação do script antes do áudio;
- TTS/composição de áudio;
- armazenamento e notificação;
- generation key contra duplicação da mesma sessão;
- checkpoints e retry a partir do último estágio útil;
- hashes e versões de prompts/modelos para rastreabilidade.

Evitar exagerar. Em vez de chamar o projeto de “fully autonomous adaptive tutor”, uma descrição mais fiel hoje seria:

> An orchestrated AI workflow that turns a learning goal into a persisted technical study roadmap and automatically prepares study sessions using current research, previous-session context, validation checks and recoverable generation stages.

Se novas capacidades forem adicionadas, atualizar essa descrição somente depois da implementação e avaliação.

## 4. Entregáveis do hackathon

O brief exige quatro blocos principais:

1. **Complete solution code + Improvement Changelog**
2. **Reproduction guide**
3. **Solution video de até 5 minutos**
4. **Representative agent trajectories**

Também é necessário mostrar melhoria sobre um baseline razoável, usando os mesmos casos e a mesma avaliação sempre que possível.

## 5. Estrutura recomendada no repositório

```text
.
├── README.md
├── .env.example
├── compose.yaml
├── package.json
│
├── docs/
│   ├── api.md
│   ├── environment.md
│   ├── architecture-and-implementation-plan.md
│   └── hackathon/
│       ├── README.md
│       ├── improvement-changelog.md
│       ├── evaluation.md
│       ├── reproduction.md
│       ├── pre-existing-vs-hackathon.md
│       ├── hot-take.md
│       ├── video-script.md
│       └── trajectories/
│           ├── README.md
│           ├── planning-example.md
│           ├── research-example.md
│           └── session-generation-example.md
│
├── evaluation/
│   ├── cases/
│   ├── rubrics/
│   ├── results/
│   │   ├── baseline.json
│   │   └── final.json
│   └── README.md
│
├── scripts/
│   ├── run-baseline.ts
│   ├── run-evaluation.ts
│   └── export-trajectories.ts
│
└── src/
    └── ...
```

Essa árvore é uma proposta. Não criar arquivo vazio só para preencher checklist.

## 6. `README.md` — landing page da submission

O README principal deve responder rapidamente:

- quem tem o problema;
- qual trabalho hoje precisa ser feito manualmente;
- o que o workflow automatiza;
- por que IA/agentes ajudam nesse ponto;
- o que é controlado por código determinístico;
- qual é o baseline;
- qual é a solução final;
- qual foi a melhoria medida;
- como reproduzir;
- links para changelog, avaliação e trajectories.

É útil mostrar que nem tudo precisa ser LLM. No projeto atual, orchestration, persistence, schemas, checkpoints, generation keys, validators, scheduling e retry são controles de software convencionais. Isso ajuda a construir uma narrativa de engenharia, não de “AI everywhere”.

A tabela de resultados deve ser preenchida apenas após os testes:

```text
Metric                         Baseline      Final workflow      Change
Primary metric                 <measured>    <measured>          <measured>
Human active time/session      <measured>    <measured>          <measured>
End-to-end success             <measured>    <measured>          <measured>
Quality/rubric score           <measured>    <measured>          <measured>
```

## 7. `docs/hackathon/README.md` — overview da competição

Estrutura sugerida:

```markdown
# Hackathon Submission

## User and problem
## Current/manual workflow
## Automated workflow
## Why these AI capabilities are used
## Baseline
## Final system
## Evaluation summary
## Main improvement
## Main failure mode
## Hot take
## Reproduce it
```

Esse documento deve ser reescrito conforme os resultados aparecem. Não deve partir de uma conclusão previamente definida.

## 8. `improvement-changelog.md`

Esse arquivo não é um changelog de versões. Ele conta a história dos **experimentos**.

Template:

```markdown
## Baseline — <name>
### Hypothesis
### What we ran
### Evidence
### Result
### Decision / learning

## Iteration N — <actual change>
### Why we tried it
### Change
### Same evaluation cases
### Evidence
### Decision
Kept / revised / removed
```

Não definir agora algo fixo como “Iteration 1 = memory, Iteration 2 = multi-agent”. Primeiro rodar o baseline, observar falhas e só então decidir o próximo experimento.

A solução final deve ser o conjunto de mudanças que **mereceram permanecer pelos resultados**.

## 9. Baseline

O baseline mais coerente com o problema pode representar o processo que a pessoa faria hoje:

```text
1. Receive learning goal
2. Manually scope/order topics
3. Manually research sources
4. Use a generic LLM/editor to prepare content
5. Manually create/adapt the podcast script
6. Generate TTS manually
7. Organize artifacts manually
8. Track progress manually
9. Repeat coordination for the next session
```

Isso captura o principal gargalo: **human orchestration**.

Pode existir, se for útil, um segundo baseline técnico mais simples:

```text
one generic prompt
  ↓
study plan + content + podcast script
```

Não usar dois baselines se isso complicar a história sem gerar informação útil.

## 10. `evaluation.md`

Baseline e solução final devem receber os mesmos casos/rubric sempre que possível.

Uma primary metric forte para esse projeto pode ser:

> **Human active orchestration time required to produce one complete, usable study session.**

Ela conecta diretamente o problema à automação.

Métricas secundárias possíveis, dependendo do que os testes mostrarem:

- end-to-end completion rate without manual correction;
- learning-objective coverage;
- source grounding rate;
- duplicate/redundant topic rate;
- consistency entre conteúdo e áudio;
- recovery effort after an injected failure.

Escolher **uma** primary metric depois de um pequeno piloto. Não selecionar a métrica apenas porque foi a que ficou mais bonita depois dos testes.

O brief recomenda 10+ casos quando a tarefa permitir e pelo menos um caso desafiador.

Exemplos de casos possíveis (não obrigatórios): Kafka reliability, API idempotency, React state management, database indexing, distributed tracing, RAG fundamentals, context engineering, retries/DLQ, caching e service decomposition.

Um caso difícil pode envolver:

- objetivo amplo demais;
- tópico muito parecido com algo já estudado;
- informação que exige pesquisa atual;
- falha intermediária para testar recovery;
- pré-requisito ainda não coberto.

## 11. Arquivos de avaliação

### `evaluation/cases/`

Casos congelados usados pelo baseline e pela solução final.

Exemplo conceitual:

```json
{
  "id": "case-01",
  "title": "Kafka Reliability",
  "goal": "Learn enough Kafka reliability concepts to design retries, idempotency and failure handling",
  "expectedObjectives": [
    "delivery semantics",
    "idempotency",
    "retry strategy",
    "dead-letter handling"
  ]
}
```

### `evaluation/rubrics/`

Rubric definida antes da avaliação final. Critérios possíveis:

- objective coverage;
- progression;
- factual grounding;
- redundancy;
- consistency;
- usability.

### `evaluation/results/`

Guardar resultados brutos de baseline/final para que o relatório seja regenerável. Não editar raw result manualmente para melhorar score.

## 12. `reproduction.md`

Deve funcionar para alguém começando de ambiente limpo e incluir:

- versões;
- clone/install;
- `.env`;
- serviços externos;
- execução normal;
- execução do baseline;
- execução da avaliação;
- localização dos resultados;
- output esperado;
- tempo aproximado;
- custo aproximado;
- limitações conhecidas.

O repo já possui `npm run build`, `npm run lint`, `npm test` e `npm run test:cov`; reutilizar isso.

Exemplo futuro, somente se os scripts existirem:

```bash
npm run eval:baseline
npm run eval:final
npm run eval:report
```

Não documentar comando que ainda não existe.

## 13. `pre-existing-vs-hackathon.md`

Como o projeto existia antes da competição, separar explicitamente:

```markdown
## Before the hackathon
- <verified capability>

## Added or changed during the hackathon
- <commit/PR + verified change>

## Why the change mattered
- <link to evaluation evidence>
```

Uma narrativa possível, se os fatos confirmarem, é:

> The hackathon was used to turn an existing automated study-content project into an evaluated agentic workflow: establish a fair baseline, instrument trajectories, measure the real bottleneck, add only changes justified by observed failures, and make the result reproducible.

## 14. Agent trajectories

A micro1 pede trajetórias representativas. Não é necessário despejar logs gigantes.

Cada trajetória deve deixar visível:

```text
input/state
  ↓
instructions + prompt version
  ↓
context
  ↓
tool request (if any)
  ↓
tool result
  ↓
model output
  ↓
validation/feedback
  ↓
retry or next stage
  ↓
final result
```

Trajetórias úteis no projeto:

- **planning-example.md**: title/goal → roadmap → schema validation → persistence;
- **research-example.md**: topic/objectives → web search → sources → research object → content context;
- **session-generation-example.md**: selection → duplicate check → previous-session context → conversation plan → script → polish → validator → TTS/checkpoints.

Nunca incluir secrets, tokens, cookies ou dados privados do Notion.

## 15. Evidências que o sistema atual permite testar

### Duplicate prevention

Separar duas coisas:

- classificação semântica do tópico;
- generation key/idempotência da mesma sessão.

Experimento possível: comparar redundância com e sem semantic duplicate checking.

### Current research

Comparar uma geração baseada apenas no modelo contra uma geração baseada na pesquisa web, usando uma rubric pré-definida.

### Prior-session context

Comparar sessões com e sem summaries anteriores e medir repetição/continuidade.

### Validation before TTS

Comparar quantos scripts inadequados chegam à geração de áudio com e sem o validator.

### Checkpoints/recovery

Injetar uma falha controlada e medir custo/tempo/chamadas necessários para recuperar com e sem checkpoints.

Esses são **candidatos a experimento**, não resultados já conhecidos.

## 16. Observabilidade mínima

Para o changelog e trajectories, cada execução deveria idealmente registrar um trace sanitizado com algo como:

```text
run_id
case_id
workflow_version
prompt_versions
model_versions
timestamps
stage
input/output hashes
tool calls
validation result
retry count
approximate cost/tokens when available
final status
```

Não é preciso adicionar uma plataforma pesada apenas por causa do hackathon. JSON estruturado por run já pode ser suficiente.

Possível layout:

```text
artifacts/runs/<run-id>/
├── trace.json
├── summary.json
└── sanitized-trajectory.md
```

## 17. `hot-take.md`

Não escrever um insight genérico antecipadamente. Registrar durante os testes:

- onde o prompt simples falha;
- que contexto realmente ajuda;
- quando histórico vira ruído;
- quanto validation melhora ou custa;
- se pesquisa web melhora factualidade;
- se splitting plan/script/polish ajuda;
- quanto checkpoint economiza em failure recovery;
- se alguma etapa com LLM ficou melhor ao ser substituída por código determinístico.

O hot take final deve sair de um failure mode observado.

## 18. `video-script.md`

O vídeo deve caber em cinco minutos:

```text
0:00–0:40  problema e trabalho manual
0:40–1:15  baseline
1:15–3:15  uma execução real end-to-end
3:15–4:10  baseline vs final + evidência
4:10–4:40  principal experimento + algo removido/rejeitado
4:40–5:00  failure mode + hot take
```

Não gastar grande parte do vídeo explicando NestJS ou pastas; mostrar o workflow e o resultado para o usuário.

## 19. O que NÃO adicionar só para parecer agentic

Não adicionar sem evidência de valor:

- múltiplos agentes apenas pelo rótulo multi-agent;
- vector DB sem problema real de retrieval;
- memory framework se o estado persistido atual resolver;
- LangChain/LangGraph só por branding;
- RAG se web search + contexto estruturado forem suficientes;
- loops autônomos sem limites;
- UI complexa que não ajude a demonstrar o problema;
- reescrita arquitetural apenas para a competição.

O objetivo é justificar cada componente pelo resultado.

## 20. Como a história deve ser construída

Em vez de determinar uma evolução artificial, usar este processo:

```text
Define real bottleneck
  ↓
Freeze evaluation cases + rubric
  ↓
Run reasonable baseline
  ↓
Observe failures
  ↓
Pick one meaningful failure
  ↓
Make the smallest useful change
  ↓
Run same evaluation
  ↓
Keep / revise / remove
  ↓
Repeat
  ↓
Final workflow = changes that earned their place
```

O Improvement Changelog deve contar exatamente essa história.

## 21. Draft inicial da narrativa

> **Draft — deve mudar depois dos experimentos.**
>
> Preparing a high-quality technical study session is not one task. A learner has to turn a broad goal into a progression, research current sources, synthesize the material, adapt it for another format, organize the result, track what has already been covered and decide what comes next. The work repeats for every session, and generic AI prompts remove only part of that coordination.
>
> This project explores whether an orchestrated AI workflow can reduce that repeated manual work while keeping the result grounded, coherent and recoverable. The user provides a learning goal; the system maintains the study roadmap and progress, selects the next eligible topic, checks for semantic duplication, researches current sources, generates the technical material, uses prior-session context to plan the conversation, validates the resulting script, produces the audio and persists the execution state so failures can resume from a checkpoint.
>
> The hackathon evaluation does not assume this architecture is better. We compare it against a reasonable baseline on the same study cases, measure the primary user outcome, and use the improvement changelog to show which components actually improved the result and which did not.

## 22. Ordem prática de trabalho

```text
1. Freeze/snapshot pre-hackathon state
2. Define problem + baseline
3. Define evaluation cases + rubric + primary metric
4. Instrument traces/metrics minimally
5. Run baseline
6. Run current workflow
7. Identify biggest failure/gap
8. Run targeted experiments
9. Build Improvement Changelog from real results
10. Freeze final workflow
11. Run final evaluation
12. Finish reproduction guide
13. Export representative trajectories
14. Rewrite README using measured claims
15. Record 5-minute video
```

## 23. Regra para Codex/AI ajudar na submission

Adicionar esta regra às instruções de trabalho da competição:

> **Do not write the submission narrative from assumptions. Inspect the current repository, evaluation artifacts and experiment results first. Every claim about an existing capability must map to code or a reproducible run. Every claim about improvement must map to evaluation evidence. Use placeholders when evidence does not exist yet.**

Isso mantém a documentação viva e evita criar uma história bonita, porém não reproduzível.

## Referências usadas

- Brief `micro1 Agentic Workflows Hackathon` fornecido na conversa, especialmente: Your challenge, How agents can help, baseline/improvement comparison, Improvement Changelog, Evaluation, Judging, Ground Rules e Final Deliverables.
- Estado atual do repositório `SamuelSSan28/ai-study-podcast-gen`, especialmente `README.md`, `src/ai/openai.gateway.ts`, `src/application/generate-next-session.use-case.ts`, `package.json` e `docs/`.
