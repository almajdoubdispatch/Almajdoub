/* Almajdoub Dispatch Track2 canonical browser API adapter.
 * No provider secrets are embedded here. Identity is supplied by an approved
 * provider adapter at window.ALMAJDOUB_PROVIDER_AUTH and tokens stay in memory.
 */
(function (window) {
  'use strict';

  const state = { accessToken: null, expiresAt: 0, user: null };
  const config = window.ALMAJDOUB_API_CONFIG || window.ALMAJDOUB_CLOUD_CONFIG || {};
  const baseUrl = String(config.apiBaseUrl || '/api/v1').replace(/\/$/, '');

  class ApiError extends Error {
    constructor(message, code, status, details) {
      super(message);
      this.name = 'AlmajdoubApiError';
      this.code = code;
      this.status = status;
      this.details = details;
    }
  }

  function newId() {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') return window.crypto.randomUUID();
    return 'mut-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
  }

  function clearSession() {
    state.accessToken = null;
    state.expiresAt = 0;
    state.user = null;
    window.dispatchEvent(new CustomEvent('almajdoub:auth-changed', { detail: { authenticated: false } }));
  }

  function setSession(session) {
    if (!session || typeof session.accessToken !== 'string' || !session.accessToken) {
      clearSession();
      throw new ApiError('A provider-issued access token is required.', 'AUTH_REQUIRED', 401);
    }
    state.accessToken = session.accessToken;
    state.expiresAt = Number(session.expiresAt || (Date.now() + 5 * 60 * 1000));
    state.user = session.user || null;
    window.dispatchEvent(new CustomEvent('almajdoub:auth-changed', { detail: { authenticated: true, user: state.user } }));
    return { user: state.user, expiresAt: state.expiresAt };
  }

  async function providerSession() {
    const provider = window.ALMAJDOUB_PROVIDER_AUTH;
    if (!provider || typeof provider.getSession !== 'function') {
      throw new ApiError('Approved identity provider is not configured.', 'AUTH_PROVIDER_NOT_CONFIGURED', 503);
    }
    const session = await provider.getSession();
    if (!session) throw new ApiError('Authentication is required.', 'AUTH_REQUIRED', 401);
    return session;
  }

  async function ensureSession() {
    if (state.accessToken && Date.now() + 15000 < state.expiresAt) return state.accessToken;
    try {
      const provider = window.ALMAJDOUB_PROVIDER_AUTH;
      if (provider && typeof provider.refreshSession === 'function') {
        const refreshed = await provider.refreshSession();
        if (refreshed) {
          setSession(refreshed);
          return state.accessToken;
        }
      }
      const session = await providerSession();
      setSession(session);
      return state.accessToken;
    } catch (err) {
      clearSession();
      throw err instanceof ApiError ? err : new ApiError('Authentication failed.', 'AUTH_REQUIRED', 401);
    }
  }

  async function parseResponse(response) {
    const text = await response.text();
    if (!text) return null;
    try { return JSON.parse(text); } catch (_) { return { raw: text }; }
  }

  async function request(path, options) {
    const opts = options || {};
    const requiresAuth = opts.requiresAuth !== false;
    const token = requiresAuth ? await ensureSession() : null;
    const headers = new Headers(opts.headers || {});
    headers.set('Accept', 'application/json');
    headers.set('Cache-Control', 'no-store');
    headers.set('Pragma', 'no-cache');
    const isFormData = typeof FormData !== 'undefined' && opts.body instanceof FormData;
    if (opts.body !== undefined && !isFormData && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
    if (token) headers.set('Authorization', 'Bearer ' + token);
    if (opts.idempotencyKey) headers.set('Idempotency-Key', opts.idempotencyKey);

    let response;
    try {
      response = await fetch(baseUrl + (path.charAt(0) === '/' ? path : '/' + path), {
        method: opts.method || 'GET',
        headers,
        body: opts.body === undefined ? undefined : (isFormData ? opts.body : JSON.stringify(opts.body)),
        cache: 'no-store',
        credentials: 'omit'
      });
    } catch (err) {
      throw new ApiError('Network unavailable; no server mutation was confirmed.', 'NETWORK_ERROR', 0, { cause: err.message });
    }
    const data = await parseResponse(response);
    if (response.status === 401 || response.status === 403) {
      clearSession();
      throw new ApiError('Authentication is required or no longer valid.', 'AUTH_REQUIRED', response.status, data);
    }
    if (response.status === 409) throw new ApiError('The server reported a version conflict.', 'OCC_CONFLICT', 409, data);
    if (!response.ok) throw new ApiError('Server request failed.', 'API_ERROR', response.status, data);
    return data;
  }

  const api = {
    errors: { ApiError },
    config: { baseUrl },
    setSession,
    clearSession,
    getAccessToken: function () { return state.accessToken; },
    getSession: function () { return state.accessToken ? { user: state.user, expiresAt: state.expiresAt } : null; },
    bootstrapSession: async function () {
      const token = await ensureSession();
      const me = await request('/auth/me');
      state.user = me && (me.user || me);
      return { accessToken: token, user: state.user, expiresAt: state.expiresAt };
    },
    providerAuth: async function () { return providerSession(); },
    request,
    publicRequest: function (path, options) { return request(path, Object.assign({}, options || {}, { requiresAuth: false })); },
    submitLoadDecision: async function (loadId, decision, expectedVersion, extra) {
      const mutationId = (extra && extra.mutationId) || newId();
      return request('/loads/' + encodeURIComponent(loadId) + '/decision', {
        method: 'POST', idempotencyKey: mutationId,
        body: Object.assign({}, extra || {}, { decision, expected_version: expectedVersion, mutation_id: mutationId })
      });
    },
    submitOnboarding: function (payload, files, signature, mutationId) {
      const form = new FormData();
      form.append('payload', JSON.stringify(payload));
      if (signature) form.append('signature', signature, 'signature.png');
      (files || []).forEach(function (file) { form.append('documents', file, file.name); });
      return api.publicRequest('/onboarding', { method: 'POST', idempotencyKey: mutationId || newId(), body: form });
    },
    submitInquiry: function (payload, mutationId) {
      return api.publicRequest('/inquiries', { method: 'POST', idempotencyKey: mutationId || newId(), body: payload });
    }
  };

  window.AlmajdoubApi = api;
})(window);
