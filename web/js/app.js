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

const PROVISIONING_STEPS = ['CREATING', 'GENERATING', 'READY'];

let currentPlanId = null;
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

function badge(status, type = 'secondary') {
  return `<span class="badge text-bg-${type} stage-badge">${escapeHtml(status)}</span>`;
}

function provisioningBadge(status) {
  const types = {
    CREATING: 'warning',
    GENERATING: 'warning',
    READY: 'success',
    FAILED: 'danger',
  };
  return badge(status, types[status] ?? 'secondary');
}

function provisioningLabel(status, sessions = []) {
  if (status === 'CREATING') return 'Gerando currículo…';
  if (status === 'GENERATING') {
    const active = sessions.find((s) => !terminalStage(s.stage));
    if (active) {
      return `Gerando episódio 1 — ${STAGE_LABELS[active.stage] ?? active.stage}`;
    }
    return 'Gerando episódio 1…';
  }
  if (status === 'READY') return 'Pronto';
  if (status === 'FAILED') return 'Falha na geração';
  return status ?? '—';
}

function stageProgress(stage) {
  if (stage === 'FAILED') return 0;
  const idx = STAGES.indexOf(stage);
  if (idx === -1) return 5;
  return Math.round(((idx + 1) / STAGES.length) * 100);
}

function terminalStage(stage) {
  return stage === 'COMPLETED' || stage === 'FAILED';
}

function isProvisioningInFlight(status) {
  return status === 'CREATING' || status === 'GENERATING';
}

function renderPipeline(provisioningStatus) {
  const idx = PROVISIONING_STEPS.indexOf(provisioningStatus);
  const activeIdx = idx === -1 ? (provisioningStatus === 'FAILED' ? 0 : 0) : idx;
  return `<div class="provisioning-pipeline mb-3">
    ${PROVISIONING_STEPS.map((step, i) => {
      const labels = { CREATING: 'Currículo', GENERATING: 'Episódio 1', READY: 'Pronto' };
      const cls = i < activeIdx ? 'done' : i === activeIdx && provisioningStatus !== 'FAILED' ? 'active' : '';
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
          ${provisioningBadge(plan.provisioningStatus ?? '—')}
        </div>
        <div class="plan-meta">${escapeHtml(truncate(plan.goal, 120))}</div>
        <div class="plan-meta">${plan.startDate} → ${plan.endDate}</div>`;
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

async function renderOverview(planId) {
  const [plan, statusRes, sessions] = await Promise.all([
    API.getPlan(planId),
    API.getPlanStatus(planId),
    API.listSessions(planId),
  ]);
  if (!plan) return;

  const provisioning = statusRes?.status ?? plan.provisioningStatus;
  const error = statusRes?.provisioningError ?? plan.provisioningError;
  const label = provisioningLabel(provisioning, sessions);
  const el = document.getElementById('tab-overview');

  el.innerHTML = `
    ${renderPipeline(provisioning)}
    <div class="mb-3">
      <div class="d-flex align-items-center gap-2 mb-1">
        <strong class="fs-5">${escapeHtml(label)}</strong>
        ${provisioningBadge(provisioning)}
      </div>
      ${provisioning === 'DRAFT' || plan.status !== 'ACTIVE' ? `<div class="plan-meta">Plano: ${escapeHtml(plan.status)}</div>` : ''}
    </div>
    ${provisioning === 'FAILED' && error ? `<div class="alert alert-danger">${escapeHtml(error)}</div>` : ''}
    ${provisioning === 'CREATING' ? '<p class="text-muted empty-hint"><span class="spinner-border spinner-border-sm me-1"></span>Currículo em geração — tópicos aparecem em ~1–3 min.</p>' : ''}
    <div class="overview-block mb-3">
      <h6>Overview</h6>
      ${plan.overview
        ? `<p>${escapeHtml(plan.overview)}</p>`
        : '<p class="text-muted placeholder-shimmer">Overview ainda não gerado…</p>'}
    </div>
    <div class="mb-3">
      <h6>Goal</h6>
      ${renderCollapsibleGoal(plan.goal)}
    </div>
    ${plan.notionUrl ? `<p><a href="${escapeHtml(plan.notionUrl)}" target="_blank" rel="noopener">Abrir no Notion</a></p>` : ''}
    ${provisioning === 'FAILED' ? '<button type="button" class="btn btn-warning" id="retry-plan-btn">Retry geração</button>' : ''}`;

  el.querySelector('.goal-toggle')?.addEventListener('click', (e) => {
    const btn = e.currentTarget;
    const short = el.querySelector('.goal-short');
    const full = el.querySelector('.goal-full');
    const expanded = full.classList.toggle('d-none');
    short.classList.toggle('d-none', !expanded);
    btn.textContent = expanded ? 'Ver menos' : 'Ver mais';
  });

  el.querySelector('#retry-plan-btn')?.addEventListener('click', async () => {
    await API.retryPlan(planId);
    showToast('Geração reenfileirada');
    startPolling();
    await renderOverview(planId);
    await renderTopics(planId);
    await renderSessions(planId);
  });
}

async function openPlan(planId) {
  currentPlanId = planId;
  const plan = await API.getPlan(planId);
  if (!plan) return;
  document.getElementById('detail-title').textContent = plan.title;
  await renderOverview(planId);
  await renderTopics(planId);
  await renderSessions(planId);
  detailModal.show();
  startPolling();
}

async function renderTopics(planId) {
  const topics = await API.listTopics(planId);
  const el = document.getElementById('tab-topics');
  const status = (await API.getPlanStatus(planId))?.status;
  if (!topics.length) {
    el.innerHTML = isProvisioningInFlight(status)
      ? '<p class="text-muted"><span class="spinner-border spinner-border-sm me-1"></span>Nenhum tópico ainda — currículo em geração.</p>'
      : '<p class="text-muted">Nenhum tópico ainda.</p>';
    return;
  }
  el.innerHTML = `<table class="table table-sm">
    <thead><tr><th>Sem</th><th>Título</th><th>Agendado</th><th>Status</th><th>Studied</th><th></th></tr></thead>
    <tbody>${topics.map((t) => `
      <tr>
        <td>${t.week}.${t.sequence}</td>
        <td>${escapeHtml(t.title)}</td>
        <td>${t.scheduledAt?.slice(0, 10) ?? '—'}</td>
        <td>${badge(t.status)}</td>
        <td>${t.studied ? '✓' : '—'}</td>
        <td>${!t.studied && t.status === 'READY' ? `<button class="btn btn-sm btn-outline-primary studied-btn" data-id="${t.id}">Marcar estudado</button>` : ''}</td>
      </tr>`).join('')}</tbody></table>`;
  el.querySelectorAll('.studied-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      await API.markStudied(planId, btn.dataset.id);
      showToast('Marcado como estudado — progresso enfileirado');
      await renderTopics(planId);
    });
  });
}

async function renderSessions(planId) {
  const sessions = await API.listSessions(planId);
  const el = document.getElementById('tab-sessions');
  const status = (await API.getPlanStatus(planId))?.status;
  if (!sessions.length) {
    el.innerHTML = isProvisioningInFlight(status)
      ? '<p class="text-muted"><span class="spinner-border spinner-border-sm me-1"></span>Nenhuma sessão ainda — episódio 1 entra na fila após o currículo.</p>'
      : '<p class="text-muted">Nenhuma sessão ainda.</p>';
    return;
  }
  el.innerHTML = sessions.map((s) => `
    <div class="session-row p-3">
      <div class="d-flex justify-content-between align-items-start gap-2">
        <div>
          <strong>${escapeHtml(s.title)}</strong>
          ${badge(STAGE_LABELS[s.stage] ?? s.stage, s.stage === 'COMPLETED' ? 'success' : s.stage === 'FAILED' ? 'danger' : 'warning')}
          <div class="plan-meta">${s.podcastMode} · retries: ${s.retryCount ?? 0}</div>
          ${s.lastError ? `<div class="text-danger small">${escapeHtml(s.lastError)}</div>` : ''}
        </div>
        <div class="btn-group btn-group-sm">
          ${s.stage === 'FAILED' ? `<button class="btn btn-outline-warning retry-btn" data-id="${s.id}">Retry</button>` : ''}
          ${s.audioUrl || s.stage === 'COMPLETED' || s.stage === 'UPLOADED' ? `<a class="btn btn-outline-success" href="${API.audioUrl(s.id)}" target="_blank">Áudio</a>` : ''}
        </div>
      </div>
      <div class="progress progress-mini mt-2"><div class="progress-bar" style="width:${stageProgress(s.stage)}%"></div></div>
    </div>`).join('');
  el.querySelectorAll('.retry-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      await API.retrySession(btn.dataset.id);
      showToast('Retry enfileirado');
      await renderSessions(planId);
    });
  });
}

function shouldKeepPolling(provisioningStatus, sessions) {
  if (isProvisioningInFlight(provisioningStatus)) return true;
  if (provisioningStatus === 'FAILED') return false;
  return sessions.some((s) => !terminalStage(s.stage));
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
        await renderOverview(currentPlanId);
        await renderTopics(currentPlanId);
      }
      if (sessions.some((s) => !terminalStage(s.stage))) {
        await renderSessions(currentPlanId);
        await renderTopics(currentPlanId);
      }
      if (!shouldKeepPolling(provisioning, sessions)) {
        stopPolling();
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
    alert.textContent = `Roadmap criado (${result.id}) — geração enfileirada`;
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
  await renderSessions(currentPlanId);
});

document.getElementById('delete-plan').addEventListener('click', async () => {
  if (!currentPlanId || !confirm('Remover este roadmap?')) return;
  await API.deletePlan(currentPlanId);
  showToast('Roadmap removido');
  detailModal.hide();
  stopPolling();
  currentPlanId = null;
  await loadPlans();
});

document.getElementById('detail-modal').addEventListener('hidden.bs.modal', stopPolling);

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
