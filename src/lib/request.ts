import type { NextRequest } from 'next/server';

/**
 * Resolves the client IP used as a rate-limit bucket key.
 *
 * `x-forwarded-for` is a client-appendable list: `X-Forwarded-For: 1.2.3.4, 5.6.7.8`
 * where the trusted edge appends the real peer. The **last** entry is the one
 * added by the proxy and is therefore the only entry an attacker cannot forge,
 * so it is preferred over the leftmost (user-controlled) value.
 *
 * `x-real-ip` / `x-vercel-forwarded-for` are set by the platform itself and are
 * used as a fallback. Returns `'anonymous'` when nothing is available, which
 * collapses those requests into one shared bucket — the safe direction to fail.
 */
export function getClientIp(request: Pick<NextRequest, 'headers'>): string {
  const headers = request.headers;

  const forwardedFor = headers.get('x-forwarded-for');
  if (forwardedFor) {
    const entries = forwardedFor
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean);
    const trusted = entries[entries.length - 1];
    if (trusted) return trusted;
  }

  const realIp =
    headers.get('x-vercel-forwarded-for')?.trim() ||
    headers.get('x-real-ip')?.trim() ||
    headers.get('cf-connecting-ip')?.trim();

  return realIp || 'anonymous';
}
