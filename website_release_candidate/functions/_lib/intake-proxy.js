export async function proxyIntake(request, env) {
  if (!env.SUPABASE_URL || !env.SUPABASE_PUBLISHABLE_KEY || !env.INTAKE_PROXY_SECRET) {
    return Response.json({ error: 'Intake service is not configured.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
  const size = Number(request.headers.get('content-length') || 0);
  if (size > 30 * 1024 * 1024) {
    return Response.json({ error: 'The submission exceeds the 30 MB limit.' }, { status: 413, headers: { 'Cache-Control': 'no-store' } });
  }
  try {
    const endpoint = `${env.SUPABASE_URL.replace(/\/$/, '')}/functions/v1/public-intake`;
    const headers = new Headers({
      apikey: env.SUPABASE_PUBLISHABLE_KEY,
      'x-intake-proxy-key': env.INTAKE_PROXY_SECRET,
      'x-forwarded-for': request.headers.get('cf-connecting-ip') || '',
      'x-intake-origin': request.headers.get('origin') || '',
      'cache-control': 'no-store'
    });
    for (const name of ['content-type', 'idempotency-key']) {
      const value = request.headers.get(name);
      if (value) headers.set(name, value);
    }
    const upstream = await fetch(endpoint, { method: 'POST', headers, body: request.body });
    return new Response(upstream.body, {
      status: upstream.status,
      headers: {
        'Content-Type': upstream.headers.get('content-type') || 'application/json',
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff'
      }
    });
  } catch (_) {
    return Response.json({ error: 'The intake service is temporarily unavailable.' }, { status: 502, headers: { 'Cache-Control': 'no-store' } });
  }
}
