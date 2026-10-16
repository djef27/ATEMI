import type { NextRequest } from 'next/server';
import { isIP } from 'node:net';

/**
 * Resolves the client IP used as a rate-limit bucket key.
 *
 * Trust only Vercel's platform-provided client IP header. Do not infer which
 * hop in `x-forwarded-for` is trusted: that depends on the deployment proxy.
 * On other platforms, requests share the anonymous bucket until a trusted
 * proxy-specific resolver is configured.
 */
export function getClientIp(request: Pick<NextRequest, 'headers'>): string {
  const headers = request.headers;

  const vercelForwardedFor = headers.get('x-vercel-forwarded-for')?.trim();
  return vercelForwardedFor && isIP(vercelForwardedFor)
    ? vercelForwardedFor
    : 'anonymous';
}
