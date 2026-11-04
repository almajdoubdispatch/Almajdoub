import { proxyIntake } from '../../_lib/intake-proxy.js';

export function onRequestPost({ request, env }) {
  return proxyIntake(request, env);
}
