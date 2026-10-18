/**
 * Rate limiter — Upstash Redis for production, in-memory fallback for dev.
 *
 * PRODUCTION: Set UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN
 * to enable distributed rate limiting via Upstash Redis.
 *
 * DEVELOPMENT: Falls back to in-memory Map (single-instance only).
 */

/**
 * Why a request was blocked.
 *
 * - `ok`         : allowed through.
 * - `limited`    : the caller's real quota is exceeded (HTTP 429).
 * - `unavailable`: a mandatory dependency (Upstash Redis) is missing or failing
 *                  for a financial endpoint. This is NOT a quota breach and must
 *                  never be reported to the user as "trop de requêtes"; the
 *                  caller should map it to HTTP 503 while keeping the endpoint
 *                  blocked (fail-closed) so an outage cannot open a free lane
 *                  to payment/order operations.
 */
export type RateLimitReason = 'ok' | 'limited' | 'unavailable';

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
  reason: RateLimitReason;
}

interface RateLimitConfig {
  windowMs: number;
  max: number;
  keyPrefix: string;
}

const UPSTASH_TIMEOUT_MS = 3_000;

async function fetchUpstash(url: string, token: string): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), UPSTASH_TIMEOUT_MS);
  try {
    return await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

// ---------------------------------------------------------------------------
// In-memory fallback (single-instance dev only)
// ---------------------------------------------------------------------------

const memoryStore = new Map<string, { count: number; resetAt: number }>();

// Auto-cleanup every 5 minutes to prevent unbounded memory growth
if (typeof setInterval !== 'undefined') {
  const cleanupTimer = setInterval(() => {
    const now = Date.now();
    memoryStore.forEach((entry, key) => {
      if (now > entry.resetAt) memoryStore.delete(key);
    });
  }, 5 * 60 * 1000);
  if (typeof cleanupTimer !== 'number') cleanupTimer.unref();
}

function memoryCheck(key: string, config: RateLimitConfig): RateLimitResult {
  const now = Date.now();
  const entry = memoryStore.get(key);

  if (!entry || now > entry.resetAt) {
    memoryStore.set(key, { count: 1, resetAt: now + config.windowMs });
    return { allowed: true, remaining: config.max - 1, retryAfterMs: 0, reason: 'ok' };
  }

  if (entry.count >= config.max) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterMs: entry.resetAt - now,
      reason: 'limited',
    };
  }

  entry.count++;
  return { allowed: true, remaining: config.max - entry.count, retryAfterMs: 0, reason: 'ok' };
}

// ---------------------------------------------------------------------------
// Upstash Redis (production)
// ---------------------------------------------------------------------------

async function upstashCheck(
  key: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  const isProduction = process.env.NODE_ENV === 'production';
  const isFinancialEndpoint = FINANCIAL_RATE_LIMIT_PREFIXES.some(prefix => config.keyPrefix.startsWith(prefix));

  // In production, financial endpoints MUST use Redis (fail-closed).
  // A missing/incomplete config is an outage of a mandatory dependency, not a
  // caller quota breach: report `unavailable` (HTTP 503 upstream) instead of
  // `limited` (HTTP 429) so the user is not falsely told they sent "too many
  // requests". The endpoint stays blocked either way — no free lane.
  if (isProduction && isFinancialEndpoint && (!url || !token)) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterMs: 60_000,
      reason: 'unavailable',
    };
  }

  // Non-financial or development: allow memory fallback
  if (!url || !token) {
    return memoryCheck(key, config);
  }

  const windowSeconds = Math.ceil(config.windowMs / 1000);

  // Use Upstash REST API with INCR + EXPIRE pattern
  let response: Response;
  try {
    response = await fetchUpstash(`${url}/incr/${key}`, token);
  } catch {
    if (isProduction && isFinancialEndpoint) {
      // Redis unreachable/timeout: dependency outage, not a quota breach.
      return { allowed: false, remaining: 0, retryAfterMs: 60_000, reason: 'unavailable' };
    }
    return memoryCheck(key, config);
  }

  if (!response.ok) {
    // Financial endpoints must not fall back to per-instance limits in production.
    // A 4xx/5xx from Upstash (bad token, quota, outage) is a dependency failure.
    if (isProduction && isFinancialEndpoint) {
      return { allowed: false, remaining: 0, retryAfterMs: 60_000, reason: 'unavailable' };
    }
    return memoryCheck(key, config);
  }

  const data = await response.json();
  const currentCount = data.result as number;

  if (currentCount === 1) {
    // First request in window — set expiry
    await fetchUpstash(`${url}/expire/${key}/${windowSeconds}`, token).catch(() => undefined);
  }

  if (currentCount > config.max) {
    // Get TTL for retry-after hint
    let ttlSeconds = windowSeconds;
    try {
      const ttlResponse = await fetchUpstash(`${url}/ttl/${key}`, token);
      const ttlData = await ttlResponse.json();
      ttlSeconds = (ttlData.result as number) || windowSeconds;
    } catch {
      // Keep the configured window as a safe Retry-After fallback.
    }

    return {
      allowed: false,
      remaining: 0,
      retryAfterMs: ttlSeconds * 1000,
      reason: 'limited',
    };
  }

  return {
    allowed: true,
    remaining: Math.max(0, config.max - currentCount),
    retryAfterMs: 0,
    reason: 'ok',
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export const RATE_LIMIT_CONFIGS = {
  paymentConfirm: {
    windowMs: 60_000, // 1 minute
    max: 5, // 5 confirmations per minute per user
    keyPrefix: 'rl:pay:confirm:',
  } as RateLimitConfig,

  paymentInitiate: {
    windowMs: 60_000,
    max: 10,
    keyPrefix: 'rl:pay:initiate:',
  } as RateLimitConfig,

  paymentWebhook: {
    windowMs: 60_000,
    max: 100, // generous for provider retries
    keyPrefix: 'rl:pay:webhook:',
  } as RateLimitConfig,

  orderCreate: {
    windowMs: 60_000,
    max: 10, // 10 orders per minute per user
    keyPrefix: 'rl:order:create:',
  } as RateLimitConfig,

  vendorProductMutation: {
    windowMs: 60_000,
    max: 20, // 20 product operations per minute per vendor
    keyPrefix: 'rl:vendor:product:',
  } as RateLimitConfig,

  // Sensitive guest recovery: exposes tracking tokens + PII.
  // Strict per-IP quota; blocked by default in production without Redis
  // (keyPrefix is covered by FINANCIAL_RATE_LIMIT_PREFIXES below).
  orderRecovery: {
    windowMs: 900_000, // 15 minutes
    max: 5, // 5 recovery attempts per IP per window
    keyPrefix: 'rl:order:recovery:',
  } as RateLimitConfig,

  adminMutation: {
    windowMs: 60_000,
    max: 30, // 30 admin operations per minute
    keyPrefix: 'rl:admin:',
  } as RateLimitConfig,

  general: {
    windowMs: 60_000,
    max: 60,
    keyPrefix: 'rl:general:',
  } as RateLimitConfig,
} as const;

export const FINANCIAL_RATE_LIMIT_PREFIXES = [
  'rl:pay:',
  'rl:order:',
] as const;

export async function checkRateLimit(
  key: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  return upstashCheck(`${config.keyPrefix}${key}`, config);
}

/**
 * Clean up expired in-memory entries (call periodically in dev).
 * No-op in production (Redis handles TTL).
 */
export function cleanupMemoryStore(): void {
  const now = Date.now();
  memoryStore.forEach((entry, key) => {
    if (now > entry.resetAt) {
      memoryStore.delete(key);
    }
  });
}
