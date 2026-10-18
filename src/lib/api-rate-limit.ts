import { NextResponse } from 'next/server';
import type { RateLimitResult } from './rate-limit';

/**
 * Maps a rate-limit decision to the correct HTTP response.
 *
 * Returns `null` when the request is allowed.
 *
 * Semantics:
 *   - `limited`    -> 429 Too Many Requests (the caller's real quota is spent).
 *   - `unavailable`-> 503 Service Unavailable (Upstash Redis is missing or
 *                     failing for a financial endpoint). The endpoint stays
 *                     blocked (fail-closed) but the user is NOT told they sent
 *                     "too many requests", which would be false and confusing.
 *
 * Both include a `Retry-After` header so clients can back off deterministically.
 * Messages are intentionally generic: they never leak configuration details.
 */
export function rateLimitResponse(
  rl: RateLimitResult,
  extraHeaders?: Record<string, string>
): NextResponse | null {
  if (rl.allowed) return null;

  const retryAfterSeconds = Math.max(1, Math.ceil(rl.retryAfterMs / 1000));
  const headers: Record<string, string> = {
    'Retry-After': String(retryAfterSeconds),
    ...extraHeaders,
  };

  if (rl.reason === 'unavailable') {
    return NextResponse.json(
      {
        success: false,
        error:
          'Le service de commande est temporairement indisponible. Veuillez réessayer dans un instant.',
      },
      { status: 503, headers }
    );
  }

  return NextResponse.json(
    { success: false, error: `Trop de requêtes. Réessayez dans ${retryAfterSeconds}s` },
    { status: 429, headers }
  );
}
