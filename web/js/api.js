const API = {
  baseUrl: window.location.origin,
  tokenKey: 'studyPodcastToken',

  getToken() {
    return localStorage.getItem(this.tokenKey) ?? '';
  },

  setToken(value) {
    localStorage.setItem(this.tokenKey, value.trim());
  },

  url(path, extraParams = {}) {
    const q = new URLSearchParams({ token: this.getToken(), ...extraParams });
    return `${this.baseUrl}${path}?${q}`;
  },

  async request(path, options = {}) {
    const response = await fetch(this.url(path), {
      headers: { 'Content-Type': 'application/json', ...(options.headers ?? {}) },
      ...options,
    });
    if (response.status === 401) throw new Error('Token inválido ou ausente');
    if (response.status === 204) return null;
    const text = await response.text();
    if (!text) return null;
    const data = JSON.parse(text);
    if (!response.ok) throw new Error(data.message ?? `HTTP ${response.status}`);
    return data;
  },

  listPlans: () => API.request('/study-plans'),
  getPlan: (id) => API.request(`/study-plans/${id}`),
  getPlanStatus: (id) => API.request(`/study-plans/${id}/status`),
  listTopics: (id) => API.request(`/study-plans/${id}/topics`),
  listSessions: (id) => API.request(`/study-plans/${id}/sessions`),
  createPlan: (body) =>
    API.request('/study-plans', { method: 'POST', body: JSON.stringify(body) }),
  generateNext: (id, mode) => {
    const extra = mode ? { mode } : {};
    return fetch(`${API.url(`/study-plans/${id}/generate-next`, extra)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }).then(async (response) => {
      if (response.status === 401) throw new Error('Token inválido');
      const data = await response.json();
      if (!response.ok) throw new Error(data.message ?? `HTTP ${response.status}`);
      return data;
    });
  },
  deletePlan: (id) =>
    fetch(API.url(`/study-plans/${id}`), { method: 'DELETE' }).then((r) => {
      if (r.status === 401) throw new Error('Token inválido');
      if (!r.ok && r.status !== 204) throw new Error(`HTTP ${r.status}`);
    }),
  markStudied: (planId, topicId, studied = true) =>
    API.request(`/study-plans/${planId}/topics/${topicId}/studied`, {
      method: 'PATCH',
      body: JSON.stringify({ studied }),
    }),
  getSession: (id) => API.request(`/sessions/${id}`),
  retrySession: (id) => API.request(`/sessions/${id}/retry`, { method: 'POST' }),
  audioUrl: (sessionId) => API.url(`/audio/${sessionId}`),
};
