const STAGES = [
  'CONTENT_PENDING', 'CONTENT_READY', 'CONVERSATION_PLAN_READY', 'SCRIPT_READY',
  'DIALOGUE_READY', 'AUDIO_READY', 'UPLOADED', 'COMPLETED',
];

let currentPlanId = null;
let pollTimer = null;
const detailModal = new bootstrap.Modal('#detail-modal');
const toastEl = document.getElementById('toast');
const toast = new bootstrap.Toast(toastEl);

function showToast(message) {
  toastEl.querySelector('.toast-body').textContent = message;
  toast.show();
}

function badge(status, type = 'secondary') {
  return `<span class="badge text-bg-${type} stage-badge">${status}</span>`;
}

function stageProgress(stage) {
  if (stage === 'FAILED') return 0;
  const idx = STAGES.indexOf(stage);
  if (idx === -1) return 10;
  return Math.round(((idx + 1) / STAGES.length) * 100);
}

function terminalStage(stage) {
  return stage === 'COMPLETED' || stage === 'FAILED';
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
    for (const plan of plans) {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'list-group-item list-group-item-action';
      item.innerHTML = `
        <div class="d-flex justify-content-between">
          <strong>${plan.title}</strong>
          ${badge(plan.status, plan.status === 'ACTIVE' ? 'success' : 'secondary')}
        </div>
        <div class="plan-meta">${plan.goal}</div>
        <div class="plan-meta">${plan.startDate} → ${plan.endDate} · ${plan.provisioningStatus ?? ''}</div>`;
      item.addEventListener('click', () => openPlan(plan.id));
      list.appendChild(item);
    }
  } catch (e) {
    empty.textContent = e instanceof Error ? e.message : 'Erro ao carregar';
    empty.classList.remove('d-none');
  }
}

async function openPlan(planId) {
  currentPlanId = planId;
  const plan = await API.getPlan(planId);
  if (!plan) return;
  document.getElementById('detail-title').textContent = plan.title;
  document.getElementById('tab-overview').innerHTML = `
    <p><strong>Goal:</strong> ${plan.goal}</p>
    <p><strong>Status:</strong> ${badge(plan.status)} ${badge(plan.provisioningStatus ?? '—', 'info')}</p>
    <p><strong>Overview:</strong> ${plan.overview || '—'}</p>
    ${plan.notionUrl ? `<p><a href="${plan.notionUrl}" target="_blank">Abrir no Notion</a></p>` : ''}`;
  await renderTopics(planId);
  await renderSessions(planId);
  detailModal.show();
  startPolling();
}

async function renderTopics(planId) {
  const topics = await API.listTopics(planId);
  const el = document.getElementById('tab-topics');
  if (!topics.length) {
    el.innerHTML = '<p class="text-muted">Nenhum tópico ainda.</p>';
    return;
  }
  el.innerHTML = `<table class="table table-sm">
    <thead><tr><th>Sem</th><th>Título</th><th>Agendado</th><th>Status</th><th>Studied</th><th></th></tr></thead>
    <tbody>${topics.map((t) => `
      <tr>
        <td>${t.week}.${t.sequence}</td>
        <td>${t.title}</td>
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
  if (!sessions.length) {
    el.innerHTML = '<p class="text-muted">Nenhuma sessão ainda.</p>';
    return;
  }
  el.innerHTML = sessions.map((s) => `
    <div class="session-row p-3">
      <div class="d-flex justify-content-between align-items-start gap-2">
        <div>
          <strong>${s.title}</strong> ${badge(s.stage, s.stage === 'COMPLETED' ? 'success' : s.stage === 'FAILED' ? 'danger' : 'warning')}
          <div class="plan-meta">${s.podcastMode} · retries: ${s.retryCount ?? 0}</div>
          ${s.lastError ? `<div class="text-danger small">${s.lastError}</div>` : ''}
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

function startPolling() {
  stopPolling();
  pollTimer = setInterval(async () => {
    if (!currentPlanId) return;
    const sessions = await API.listSessions(currentPlanId);
    if (sessions.some((s) => !terminalStage(s.stage))) {
      await renderSessions(currentPlanId);
      await renderTopics(currentPlanId);
    }
  }, 10000);
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
    alert.textContent = `Roadmap criado (${result.id}) — geração enfileirada (${result.status})`;
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
