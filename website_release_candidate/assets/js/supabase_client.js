/* Legacy name retained for compatibility; no direct Supabase or local fallback. */
(function (window) {
  'use strict';
  const client = {
    isConfigured: function () { return Boolean(window.AlmajdoubApi); },
    configure: function () { throw new Error('Runtime API configuration is owned by deployment; client secrets are not accepted.'); },
    submitInquiry: async function (data) {
      if (!window.AlmajdoubApi) return { success: false, code: 'API_CLIENT_NOT_LOADED' };
      try { return { success: true, mode: 'api', data: await window.AlmajdoubApi.submitInquiry(data) }; }
      catch (e) { return { success: false, mode: 'api_error', code: e.code || 'API_ERROR', error: e.message }; }
    },
    logPageView: async function () { return { success: false, code: 'ANALYTICS_DISABLED_UNTIL_API_CONFIGURED' }; }
  };
  window.SupabaseClient = client;
})(window);
