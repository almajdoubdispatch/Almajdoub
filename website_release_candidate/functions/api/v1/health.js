export async function onRequestGet({ env }) {
  if (!env.SUPABASE_URL || !env.SUPABASE_PUBLISHABLE_KEY) {
    return Response.json({ status: 'degraded' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
  try {
    const response = await fetch(`${env.SUPABASE_URL.replace(/\/$/, '')}/functions/v1/public-intake`, {
      headers: { apikey: env.SUPABASE_PUBLISHABLE_KEY },
      cf: { cacheTtl: 0 }
    });
    return Response.json({ status: response.ok ? 'ok' : 'degraded' }, {
      status: response.ok ? 200 : 503,
      headers: { 'Cache-Control': 'no-store' }
    });
  } catch (_) {
    return Response.json({ status: 'degraded' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}
