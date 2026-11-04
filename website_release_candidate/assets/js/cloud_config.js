/* Public runtime configuration only. Provider credentials are never shipped in source. */
window.ALMAJDOUB_API_CONFIG = Object.assign({ apiBaseUrl: '/api/v1' }, window.ALMAJDOUB_API_CONFIG || {});
window.ALMAJDOUB_CLOUD_CONFIG = window.ALMAJDOUB_API_CONFIG;
