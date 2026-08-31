const STAGES = [
  'CONTENT_PENDING',
  'CONTENT_READY',
  'CONVERSATION_PLAN_PENDING',
  'CONVERSATION_PLAN_READY',
  'SCRIPT_PENDING',
  'SCRIPT_READY',
  'DIALOGUE_POLISH_PENDING',
  'DIALOGUE_READY',
  'AUDIO_PENDING',
  'AUDIO_GENERATING',
  'AUDIO_READY',
  'UPLOAD_PENDING',
  'UPLOADED',
  'COMPLETED',
];

const STAGE_LABELS = {
  CONTENT_PENDING: 'Pesquisa e conteúdo…',
  CONTENT_READY: 'Conteúdo pronto',
  CONVERSATION_PLAN_PENDING: 'Plano da conversa…',
  CONVERSATION_PLAN_READY: 'Plano da conversa pronto',
  SCRIPT_PENDING: 'Roteiro…',
  SCRIPT_READY: 'Roteiro pronto',
  DIALOGUE_POLISH_PENDING: 'Polindo diálogo…',
  DIALOGUE_READY: 'Diálogo pronto',
  AUDIO_PENDING: 'Preparando áudio…',
  AUDIO_GENERATING: 'Gerando áudio…',
  AUDIO_READY: 'Áudio pronto',
  UPLOAD_PENDING: 'Enviando…',
  UPLOADED: 'Enviado',
  COMPLETED: 'Concluído',
  FAILED: 'Falhou',
};

const TOPIC_STATUS_LABELS = {
  PLANNED: 'Planejado',
  GENERATING: 'Gerando',
  READY: 'Pronto',
  COMPLETED: 'Concluído',
  FAILED: 'Falhou',
  SKIPPED: 'Pulado',
};

const TOPIC_STATUS_TYPES = {
  PLANNED: 'secondary',
  GENERATING: 'warning',
  READY: 'success',
  COMPLETED: 'success',
  FAILED: 'danger',
  SKIPPED: 'secondary',
};

const PLAN_STATUS_LABELS = {
  DRAFT: 'Rascunho',
  ACTIVE: 'Em andamento',
  PAUSED: 'Pausado',
  COMPLETED: 'Concluído',
};

const LEVEL_LABELS = {
  FOUNDATION: 'Fundamentos',
  FOUNDATIONAL: 'Fundamentos',
  CORE: 'Essencial',
  INTERMEDIATE: 'Intermediário',
  ADVANCED: 'Avançado',
  APPLIED: 'Aplicado',
};

const SPEAKER_LABELS = {
  HOST: 'Apresentador',
  INTERVIEWER: 'Entrevistador',
  CANDIDATE: 'Candidato',
  ENGINEER_A: 'Engenheiro A',
  ENGINEER_B: 'Engenheiro B',
};

const PROVISIONING_STEPS = ['CREATING', 'GENERATING', 'READY'];

let currentPlanId = null;
let expandedTopicId = null;
let pollTimer = null;
let listPollTimer = null;
const detailModal = new bootstrap.Modal('#detail-modal');
const toastEl = document.getElementById('toast');
const toast = new bootstrap.Toast(toastEl);

function showToast(message) {
  toastEl.querySelector('.toast-body').textContent = message;
  toast.show();
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text ?? '';
  return div.innerHTML;
}

function truncate(text, max = 200) {
  if (!text || text.length <= max) return text ?? '';
  return `${text.slice(0, max)}…`;
}

function padOrder(n) {
  return String(n).padStart(2, '0');
}

function formatDateShort(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

function formatDateRange(start, end) {
  if (!start && !end) return '—';
  return `${formatDateShort(start)} — ${formatDateShort(end)}`;
}

function badge(status, type = 'secondary') {
  return `<span class="badge text-bg-${type} stage-badge">${escapeHtml(status)}</span>`;
}

function planListStatusBadge(plan) {
  const provisioning = plan.provisioningStatus;
  if (provisioning === 'FAILED') return badge('Falhou', 'danger');
  if (provisioning === 'CREATING') return badge('Gerando currículo', 'warning');
  if (provisioning === 'GENERATING') return badge('Gerando conteúdo', 'warning');

  const label = PLAN_STATUS_LABELS[plan.status] ?? plan.status ?? '—';
  const types = {
    ACTIVE: 'primary',
    COMPLETED: 'success',
    PAUSED: 'secondary',
    DRAFT: 'secondary',
  };
  return badge(label, types[plan.status] ?? 'secondary');
}

function topicBadge(status) {
  return badge(TOPIC_STATUS_LABELS[status] ?? status, TOPIC_STATUS_TYPES[status] ?? 'secondary');
}

function levelBadge(level) {
  if (!level) return '';
  const label = LEVEL_LABELS[level] ?? level;
  return `<span class="level-badge">${escapeHtml(label)}</span>`;
}

function speakerLabel(speaker) {
  return SPEAKER_LABELS[speaker] ?? speaker;
}

function provisioningLabel(status, sessions = []) {
  if (status === 'CREATING') return 'Gerando currículo…';
  if (status === 'GENERATING') {
    const active = sessions.find((s) => !terminalStage(s.stage));
    if (active) {
      return `Gerando primeiro tópico — ${STAGE_LABELS[active.stage] ?? active.stage}`;
    }
    return 'Gerando primeiro tópico…';
  }
  if (status === 'READY') return 'Pronto';
  if (status === 'FAILED') return 'Falha na geração';
  return status ?? '—';
}

function stageIndex(stage) {
  return STAGES.indexOf(stage);
}

function terminalStage(stage) {
  return stage === 'COMPLETED' || stage === 'FAILED';
}

function sessionHasArticle(session) {
  if (!session) return false;
  return stageIndex(session.stage) >= stageIndex('CONTENT_READY') && session.stage !== 'FAILED';
}

function sessionHasScript(session) {
  if (!session) return false;
  return stageIndex(session.stage) >= stageIndex('SCRIPT_READY') && session.stage !== 'FAILED';
}

function sessionHasAudio(session) {
  if (!session) return false;
  return (
    ['AUDIO_READY', 'UPLOAD_PENDING', 'UPLOADED', 'COMPLETED'].includes(session.stage) ||
    Boolean(session.audioUrl)
  );
}

function sessionIsGenerating(session) {
  if (!session) return false;
  return !terminalStage(session.stage);
}

function topicIsComplete(topic, session) {
  if (topic.studied) return true;
  return session?.stage === 'COMPLETED';
}

function countCompletedTopics(topics, byTopic) {
  return topics.filter((t) => topicIsComplete(t, (byTopic.get(t.id) ?? [])[0])).length;
}

function topicListIcon(topic, plan, session) {
  if (topicIsComplete(topic, session)) return '✓';
  if (plan.currentTopicId === topic.id || (session && sessionIsGenerating(session))) return '→';
  return '○';
}

function topicListIconClass(topic, plan, session) {
  if (topicIsComplete(topic, session)) return 'topic-icon-done';
  if (plan.currentTopicId === topic.id || (session && sessionIsGenerating(session))) return 'topic-icon-current';
  return 'topic-icon-pending';
}

function isProvisioningInFlight(status) {
  return status === 'CREATING' || status === 'GENERATING';
}

function renderPipeline(provisioningStatus) {
  const idx = PROVISIONING_STEPS.indexOf(provisioningStatus);
  const activeIdx = idx === -1 ? 0 : idx;
  return `<div class="provisioning-pipeline mb-3">
    ${PROVISIONING_STEPS.map((step, i) => {
      const labels = { CREATING: 'Currículo', GENERATING: 'Conteúdo 1', READY: 'Pronto' };
      const cls =
        i < activeIdx ? 'done' : i === activeIdx && provisioningStatus !== 'FAILED' ? 'active' : '';
      return `<div class="pipeline-step ${cls}"><span class="pipeline-dot"></span><span>${labels[step]}</span></div>`;
    }).join('')}
  </div>`;
}

function renderCollapsibleGoal(goal) {
  const short = truncate(goal, 200);
  const needsToggle = goal && goal.length > 200;
  if (!needsToggle) return `<p class="goal-text">${escapeHtml(goal)}</p>`;
  return `<div class="goal-block">
    <p class="goal-text goal-short">${escapeHtml(short)}</p>
    <p class="goal-text goal-full d-none">${escapeHtml(goal)}</p>
    <button type="button" class="btn btn-link btn-sm p-0 goal-toggle">Ver mais</button>
  </div>`;
}

function renderProgressBar(completed, total) {
  const pct = total ? Math.round((completed / total) * 100) : 0;
  return `<div class="plan-progress">
    <div class="d-flex justify-content-between align-items-center mb-1">
      <span class="small text-muted">Progresso</span>
      <span class="small fw-semibold">${completed} de ${total} concluídos</span>
    </div>
    <div class="progress progress-roadmap"><div class="progress-bar" style="width:${pct}%"></div></div>
  </div>`;
}

function sessionAudioUrl(session) {
  if (!session?.id) return '';
  if (session.audioUrl) {
    try {
      const external = new URL(session.audioUrl, window.location.origin);
      const isLocalAudio = external.pathname.startsWith('/audio/');
      if (!isLocalAudio) return session.audioUrl;
    } catch {
      /* fall through to authenticated local URL */
    }
  }
  return API.audioUrl(session.id);
}

function renderInlineAudio(session) {
  const src = escapeHtml(sessionAudioUrl(session));
  return `<audio class="inline-audio" controls preload="metadata" src="${src}">
    Seu navegador não suporta reprodução de áudio.
  </audio>`;
}

function renderMaterialCard({ icon, label, ready, readyLabel, pendingLabel, actionHtml = '', extraClass = '' }) {
  return `<div class="material-card ${ready ? 'material-ready' : 'material-pending'} ${extraClass}">
    <div class="material-icon">${icon}</div>
    <div class="material-body">
      <div class="material-label">${escapeHtml(label)}</div>
      <div class="material-status">${ready ? escapeHtml(readyLabel) : escapeHtml(pendingLabel)}</div>
      ${actionHtml ? `<div class="material-actions">${actionHtml}</div>` : ''}
    </div>
  </div>`;
}

function renderPodcastMaterialCard(session, audioReady, pendingLabel) {
  const status = audioReady ? 'Disponível' : pendingLabel;
  return `<div class="material-card material-card-podcast ${audioReady ? 'material-ready' : 'material-pending'}">
    <div class="material-card-header">
      <div class="material-icon">🎧</div>
      <div class="material-body">
        <div class="material-label">Podcast</div>
        <div class="material-status">${escapeHtml(status)}</div>
      </div>
    </div>
    ${audioReady ? renderInlineAudio(session) : ''}
  </div>`;
}

function renderTopicMaterials(topic, session) {
  const articleReady = sessionHasArticle(session);
  const scriptReady = sessionHasScript(session);
  const audioReady = sessionHasAudio(session);

  const articleAction =
    articleReady && session?.notionUrl
      ? `<a class="btn btn-sm btn-outline-primary" href="${escapeHtml(session.notionUrl)}" target="_blank" rel="noopener">Ler artigo</a>`
      : '';

  const audioAction = audioReady ? renderInlineAudio(session) : '';

  const scriptAction = scriptReady
    ? `<button type="button" class="btn btn-sm btn-link p-0 script-toggle" data-session-id="${session.id}">Ver roteiro</button>`
    : '';

  return `<div class="materials-grid">
    ${renderMaterialCard({
      icon: '📖',
      label: 'Artigo',
      ready: articleReady,
      readyLabel: session?.notionUrl ? 'Disponível' : 'Gerado',
      pendingLabel: sessionIsGenerating(session) ? STAGE_LABELS[session.stage] ?? 'Gerando…' : 'Ainda não gerado',
      actionHtml: articleAction,
    })}
    ${renderMaterialCard({
      icon: '🎧',
      label: 'Podcast',
      ready: audioReady,
      readyLabel: 'Disponível',
      pendingLabel: sessionIsGenerating(session) ? STAGE_LABELS[session.stage] ?? 'Gerando…' : 'Ainda não gerado',
      actionHtml: audioAction,
    })}
    ${renderMaterialCard({
      icon: '📝',
      label: 'Roteiro',
      ready: scriptReady,
      readyLabel: 'Disponível',
      pendingLabel: sessionIsGenerating(session) ? STAGE_LABELS[session.stage] ?? 'Gerando…' : 'Ainda não gerado',
      actionHtml: scriptAction,
    })}
  </div>
  <div class="script-panel d-none" data-script-for="${session?.id ?? ''}"></div>`;
}

function renderTopicDetail(topic, index, total, plan, session) {
  const complete = topicIsComplete(topic, session);
  const contentReady = session && sessionHasArticle(session);
  const objectives = topic.learningObjectives ?? [];

  return `<div class="topic-detail">
    <div class="topic-detail-header">
      <div class="topic-position">${padOrder(index + 1)} / ${total}</div>
      <h3 class="topic-detail-title">${escapeHtml(topic.title)}</h3>
      <div class="topic-detail-meta">
        ${levelBadge(topic.level)}
        <span class="topic-meta-sep">·</span>
        <span>${topic.estimatedMinutes ?? plan.targetSessionMinutes ?? '—'} min</span>
        <span class="topic-meta-sep">·</span>
        ${topicBadge(topic.status)}
        ${complete ? badge('Conteúdo gerado', 'success') : ''}
      </div>
      ${
        topic.summary || topic.description
          ? `<p class="topic-detail-desc">${escapeHtml(topic.summary || topic.description)}</p>`
          : ''
      }
    </div>

    ${
      objectives.length
        ? `<div class="topic-objectives">
            <h6 class="section-label">O que você vai aprender</h6>
            <ul class="objective-list">
              ${objectives.map((o) => `<li>${escapeHtml(o)}</li>`).join('')}
            </ul>
          </div>`
        : ''
    }

    <div class="topic-materials-section">
      <h6 class="section-label">Materiais</h6>
      ${session ? renderTopicMaterials(topic, session) : renderTopicMaterials(topic, null)}
    </div>

    ${
      session?.lastError
        ? `<div class="alert alert-danger py-2 small mt-3">${escapeHtml(session.lastError)}</div>`
        : ''
    }

    <div class="topic-detail-actions">
      ${
        contentReady
          ? `<div class="content-actions mb-2">
              ${session.notionUrl ? `<a class="btn btn-primary btn-sm" href="${escapeHtml(session.notionUrl)}" target="_blank" rel="noopener">Ler artigo</a>` : ''}
            </div>`
          : ''
      }
      ${
        session && session.stage === 'FAILED'
          ? `<button class="btn btn-sm btn-outline-warning retry-btn" data-id="${session.id}">Tentar novamente</button>`
          : ''
      }
      ${
        !complete && (topic.status === 'READY' || contentReady)
          ? `<button class="btn btn-sm btn-success studied-btn" data-id="${topic.id}">✓ Marcar como concluído</button>`
          : complete
            ? `<span class="text-success small">✓ Concluído</span>`
            : ''
      }
    </div>
  </div>`;
}

function renderTopicRow(topic, index, total, plan, session, expanded) {
  const icon = topicListIcon(topic, plan, session);
  const iconClass = topicListIconClass(topic, plan, session);
  const isCurrent = plan.currentTopicId === topic.id;
  const subtitle = truncate(topic.summary || topic.description, 90);
  const complete = topicIsComplete(topic, session);

  return `<div class="topic-row ${expanded ? 'topic-row-expanded' : ''} ${isCurrent ? 'topic-row-current' : ''}" data-topic-id="${topic.id}">
    <button type="button" class="topic-row-toggle" aria-expanded="${expanded}">
      <span class="topic-icon ${iconClass}" aria-hidden="true">${icon}</span>
      <span class="topic-row-main">
        <span class="topic-row-title">
          <span class="topic-order">${padOrder(index + 1)}</span>
          ${escapeHtml(topic.title)}
        </span>
        ${
          subtitle
            ? `<span class="topic-row-subtitle">${escapeHtml(subtitle)}</span>`
            : ''
        }
        <span class="topic-row-badges">
          ${levelBadge(topic.level)}
          <span class="topic-meta-sep">·</span>
          <span>${topic.estimatedMinutes ?? plan.targetSessionMinutes ?? '—'} min</span>
          ${isCurrent && !complete ? '<span class="topic-next-label">Próximo</span>' : ''}
        </span>
      </span>
    </button>
    ${expanded ? renderTopicDetail(topic, index, total, plan, session) : ''}
  </div>`;
}

async function testConnection() {
  const badgeEl = document.getElementById('connection-badge');
  try {
    await API.listPlans();
    badgeEl.textContent = 'conectado';
    badgeEl.className = 'badge text-bg-success';
    return true;
  } catch {
    badgeEl.textContent = 'desconectado';
    badgeEl.className = 'badge text-bg-danger';
    return false;
  }
}

async function loadPlans() {
  const list = document.getElementById('plans-list');
  const empty = document.getElementById('plans-empty');
  list.innerHTML = '';
  try {
    const plans = await API.listPlans();
    empty.classList.toggle('d-none', plans.length > 0);
    const hasInFlight = plans.some((p) => isProvisioningInFlight(p.provisioningStatus));
    if (hasInFlight && !listPollTimer) startListPolling();
    if (!hasInFlight && listPollTimer) stopListPolling();

    for (const plan of plans) {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'list-group-item list-group-item-action';
      item.innerHTML = `
        <div class="d-flex justify-content-between align-items-center gap-2">
          <strong>${escapeHtml(plan.title)}</strong>
          <span>${planListStatusBadge(plan)}</span>
        </div>
        <div class="plan-meta">${escapeHtml(truncate(plan.goal, 120))}</div>
        <div class="plan-meta">${formatDateRange(plan.startDate, plan.endDate)}</div>`;
      item.addEventListener('click', () => openPlan(plan.id));
      list.appendChild(item);
    }
  } catch (e) {
    empty.textContent = e instanceof Error ? e.message : 'Erro ao carregar';
    empty.classList.remove('d-none');
  }
}

function startListPolling() {
  stopListPolling();
  listPollTimer = setInterval(loadPlans, 10000);
}

function stopListPolling() {
  if (listPollTimer) clearInterval(listPollTimer);
  listPollTimer = null;
}

function bindTopicInteractions(el, planId) {
  el.querySelectorAll('.topic-row-toggle').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const row = btn.closest('.topic-row');
      const topicId = row?.dataset.topicId;
      if (!topicId) return;
      expandedTopicId = expandedTopicId === topicId ? null : topicId;
      await renderPlanDetail(planId);
    });
  });

  el.querySelectorAll('.studied-btn').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      await API.markStudied(planId, btn.dataset.id);
      showToast('Marcado como concluído');
      await renderPlanDetail(planId);
    });
  });

  el.querySelectorAll('.retry-btn').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      await API.retrySession(btn.dataset.id);
      showToast('Nova tentativa enfileirada');
      await renderPlanDetail(planId);
    });
  });

  el.querySelectorAll('.inline-audio').forEach((player) => {
    player.addEventListener('play', () => {
      el.querySelectorAll('.inline-audio').forEach((other) => {
        if (other !== player && !other.paused) other.pause();
      });
    });
  });

  el.querySelectorAll('.script-toggle').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const sessionId = btn.dataset.sessionId;
      const panel = el.querySelector(`.script-panel[data-script-for="${sessionId}"]`);
      if (!panel) return;

      if (!panel.classList.contains('d-none')) {
        panel.classList.add('d-none');
        btn.textContent = 'Ver roteiro';
        return;
      }

      panel.innerHTML = '<p class="text-muted small mb-0">Carregando roteiro…</p>';
      panel.classList.remove('d-none');
      btn.textContent = 'Ocultar roteiro';

      try {
        const session = await API.getSession(sessionId);
        const turns = session?.script?.turns ?? session?.rawScript?.turns ?? [];
        if (!turns.length) {
          panel.innerHTML = '<p class="text-muted small mb-0">Roteiro ainda não disponível.</p>';
          return;
        }
        panel.innerHTML = `<div class="script-transcript">${turns
          .map(
            (t) =>
              `<div class="script-turn"><strong>${escapeHtml(speakerLabel(t.speaker))}</strong><p>${escapeHtml(t.text)}</p></div>`,
          )
          .join('')}</div>`;
      } catch (err) {
        panel.innerHTML = `<p class="text-danger small mb-0">${escapeHtml(err instanceof Error ? err.message : 'Erro')}</p>`;
      }
    });
  });
}

async function renderPlanDetail(planId) {
  const [topics, sessions, plan, statusRes] = await Promise.all([
    API.listTopics(planId),
    API.listSessions(planId),
    API.getPlan(planId),
    API.getPlanStatus(planId),
  ]);
  const el = document.getElementById('plan-detail');
  const provisioning = statusRes?.status ?? plan?.provisioningStatus;
  const error = statusRes?.provisioningError ?? plan?.provisioningError;
  if (!plan) {
    el.innerHTML = '<p class="text-muted">Plano não encontrado.</p>';
    return;
  }

  const label = provisioningLabel(provisioning, sessions);
  const phaseLabel =
    provisioning === 'CREATING'
      ? 'Geração do currículo'
      : provisioning === 'GENERATING'
        ? 'Geração do primeiro tópico'
        : provisioning === 'READY'
          ? 'Geração concluída'
          : provisioning === 'FAILED'
            ? 'Geração interrompida'
            : provisioning;

  const statusSection =
    provisioning === 'FAILED' && error
      ? `<div class="alert alert-danger mb-2">
          <div class="fw-semibold mb-1">Falhou em: ${escapeHtml(phaseLabel)}</div>
          <code class="small d-block text-break">${escapeHtml(error)}</code>
        </div>
        <button type="button" class="btn btn-warning btn-sm" id="retry-plan-btn">Tentar novamente</button>`
      : isProvisioningInFlight(provisioning)
        ? `<p class="mb-0 text-muted">${escapeHtml(phaseLabel)} — ${escapeHtml(label)}</p>`
        : '';

  const byTopic = new Map();
  for (const s of sessions) {
    const list = byTopic.get(s.topicId) ?? [];
    list.push(s);
    byTopic.set(s.topicId, list);
  }

  const ordered = [...topics].sort((a, b) => a.order - b.order);
  const completedCount = countCompletedTopics(ordered, byTopic);
  const minutes = plan.targetSessionMinutes ?? 45;

  const header = `
    ${isProvisioningInFlight(provisioning) || provisioning === 'FAILED' ? renderPipeline(provisioning) : ''}
    <section class="roadmap-hero mb-4">
      <h2 class="roadmap-title">${escapeHtml(plan.title)}</h2>
      ${
        plan.goal
          ? `<p class="roadmap-goal">${escapeHtml(truncate(plan.goal, 160))}</p>`
          : ''
      }
      <div class="roadmap-stats">
        ${badge(PLAN_STATUS_LABELS[plan.status] ?? plan.status, plan.status === 'ACTIVE' ? 'primary' : 'secondary')}
        <span class="roadmap-stat">${ordered.length} tópico${ordered.length === 1 ? '' : 's'} · ${minutes} min por sessão</span>
        <span class="roadmap-stat">${formatDateRange(plan.startDate, plan.endDate)}</span>
      </div>
      ${
        ordered.length
          ? renderProgressBar(completedCount, ordered.length)
          : ''
      }
      ${
        plan.notionUrl
          ? `<p class="mb-0 mt-2"><a href="${escapeHtml(plan.notionUrl)}" target="_blank" rel="noopener">Abrir no Notion</a></p>`
          : ''
      }
      ${statusSection}
      ${
        provisioning === 'CREATING'
          ? '<p class="text-muted empty-hint mt-2 mb-0"><span class="spinner-border spinner-border-sm me-1"></span>Currículo em geração…</p>'
          : ''
      }
    </section>`;

  if (!topics.length) {
    el.innerHTML =
      header +
      (isProvisioningInFlight(provisioning)
        ? '<p class="text-muted"><span class="spinner-border spinner-border-sm me-1"></span>Nenhum tópico ainda — currículo em geração.</p>'
        : '<p class="text-muted">Nenhum tópico ainda.</p>');

    el.querySelector('#retry-plan-btn')?.addEventListener('click', async () => {
      await API.retryPlan(planId);
      showToast('Geração reenfileirada');
      startPolling();
      await renderPlanDetail(planId);
    });
    return;
  }

  el.innerHTML = `${header}
    <section class="curriculum-section">
      <h6 class="section-label">Currículo</h6>
      <div class="curriculum-list">
        ${ordered
          .map((t, i) => {
            const session = (byTopic.get(t.id) ?? [])[0];
            const expanded = expandedTopicId === t.id;
            return renderTopicRow(t, i, ordered.length, plan, session, expanded);
          })
          .join('')}
      </div>
    </section>`;

  bindTopicInteractions(el, planId);

  el.querySelector('#retry-plan-btn')?.addEventListener('click', async () => {
    await API.retryPlan(planId);
    showToast('Geração reenfileirada');
    startPolling();
    await renderPlanDetail(planId);
  });
}

async function openPlan(planId) {
  currentPlanId = planId;
  const plan = await API.getPlan(planId);
  if (!plan) return;
  expandedTopicId = plan.currentTopicId ?? null;
  document.getElementById('detail-title').textContent = plan.title;
  await renderPlanDetail(planId);
  detailModal.show();
  startPolling();
}

function shouldKeepPolling(provisioningStatus, sessions) {
  if (isProvisioningInFlight(provisioningStatus)) return true;
  if (provisioningStatus === 'FAILED') return false;
  return sessions.some((s) => !terminalStage(s.stage));
}

function isAudioPlayingInDetail() {
  const el = document.getElementById('plan-detail');
  if (!el) return false;
  return [...el.querySelectorAll('.inline-audio')].some((player) => !player.paused && !player.ended);
}

function startPolling() {
  stopPolling();
  pollTimer = setInterval(async () => {
    if (!currentPlanId) return;
    try {
      const statusRes = await API.getPlanStatus(currentPlanId);
      const sessions = await API.listSessions(currentPlanId);
      const provisioning = statusRes?.status;

      if (isProvisioningInFlight(provisioning) || provisioning === 'FAILED') {
        if (!isAudioPlayingInDetail()) await renderPlanDetail(currentPlanId);
      }
      if (sessions.some((s) => !terminalStage(s.stage))) {
        if (!isAudioPlayingInDetail()) await renderPlanDetail(currentPlanId);
      }
      if (!shouldKeepPolling(provisioning, sessions)) {
        stopPolling();
        if (!isAudioPlayingInDetail()) await renderPlanDetail(currentPlanId);
      }
    } catch {
      /* keep polling on transient errors */
    }
  }, 5000);
}

function stopPolling() {
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = null;
}

document.getElementById('save-token').addEventListener('click', async () => {
  API.setToken(document.getElementById('token').value);
  if (await testConnection()) {
    showToast('Token salvo');
    await loadPlans();
  }
});

document.getElementById('refresh-plans').addEventListener('click', loadPlans);

document.getElementById('create-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const alert = document.getElementById('create-alert');
  alert.classList.add('d-none');
  try {
    const body = {
      title: document.getElementById('title').value,
      goal: document.getElementById('goal').value,
    };
    const minutes = document.getElementById('minutes').value;
    if (minutes) body.settings = { targetSessionMinutes: Number(minutes) };
    const result = await API.createPlan(body);
    alert.className = 'alert alert-success mt-3';
    alert.textContent = `Plano criado (${result.id}) — geração enfileirada`;
    alert.classList.remove('d-none');
    await loadPlans();
    openPlan(result.id);
  } catch (err) {
    alert.className = 'alert alert-danger mt-3';
    alert.textContent = err instanceof Error ? err.message : 'Erro';
    alert.classList.remove('d-none');
  }
});

document.getElementById('generate-next').addEventListener('click', async () => {
  if (!currentPlanId) return;
  const mode = document.getElementById('generate-mode').value;
  await API.generateNext(currentPlanId, mode);
  showToast('Geração enfileirada');
  startPolling();
  await renderPlanDetail(currentPlanId);
});

document.getElementById('delete-plan').addEventListener('click', async () => {
  if (!currentPlanId || !confirm('Remover este plano de estudos?')) return;
  await API.deletePlan(currentPlanId);
  showToast('Plano removido');
  detailModal.hide();
  stopPolling();
  currentPlanId = null;
  expandedTopicId = null;
  await loadPlans();
});

document.getElementById('detail-modal').addEventListener('hidden.bs.modal', () => {
  stopPolling();
  expandedTopicId = null;
});

document.getElementById('token').value = API.getToken();
if (API.getToken()) {
  testConnection().then((ok) => ok && loadPlans());
}

const urlPlan = new URLSearchParams(window.location.search).get('plan');
if (urlPlan && API.getToken()) {
  testConnection().then((ok) => {
    if (ok) openPlan(urlPlan);
  });
}
