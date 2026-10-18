/**
 * Rate-limit availability semantics + duplicate-order protection.
 *
 * Regression suite for the production 429 incident: a MISSING or FAILING Upstash
 * Redis used to be reported to the caller as HTTP 429 "Trop de requêtes", which
 * is false (the caller never exhausted a quota) and blocked every order/payment
 * with a misleading message. Now:
 *   - real quota breach         -> 429 (reason `limited`)
 *   - dependency missing/down   -> 503 (reason `unavailable`, still fail-closed)
 */
import fs from 'fs';
import path from 'path';

// next/server pulls in web Request/Response globals that are absent in the Jest
// environment. Mock the tiny surface we use (NextResponse.json) so the helper's
// HTTP mapping can be asserted without loading the real server runtime.
jest.mock('next/server', () => ({
  NextResponse: {
    json: (
      body: unknown,
      init?: { status?: number; headers?: Record<string, string> }
    ) => {
      const map = new Map<string, string>();
      if (init?.headers) for (const [k, v] of Object.entries(init.headers)) map.set(k, v);
      return {
        status: init?.status ?? 200,
        headers: { get: (k: string) => map.get(k) ?? null },
        json: async () => body,
      };
    },
  },
}));

import {
  checkRateLimit,
  RATE_LIMIT_CONFIGS,
  cleanupMemoryStore,
  type RateLimitResult,
} from '@/lib/rate-limit';
import { rateLimitResponse } from '@/lib/api-rate-limit';

const FINANCIAL_CONFIG = { windowMs: 60_000, max: 3, keyPrefix: 'rl:order:create:' };
const NON_FINANCIAL_CONFIG = { windowMs: 60_000, max: 3, keyPrefix: 'rl:general:' };

// process.env.NODE_ENV is typed read-only; use a mutable alias for the test.
const env = process.env as Record<string, string | undefined>;

const originalEnv = {
  NODE_ENV: env.NODE_ENV,
  UPSTASH_REDIS_REST_URL: env.UPSTASH_REDIS_REST_URL,
  UPSTASH_REDIS_REST_TOKEN: env.UPSTASH_REDIS_REST_TOKEN,
};

const realFetch = global.fetch;

function mockFetch(impl: () => Promise<Response>) {
  global.fetch = jest.fn(impl) as unknown as typeof fetch;
}

function okJson(result: number): Response {
  return { ok: true, json: async () => ({ result }) } as unknown as Response;
}

function httpError(status: number): Response {
  return { ok: false, status, json: async () => ({}) } as unknown as Response;
}

beforeEach(() => {
  cleanupMemoryStore();
  env.NODE_ENV = 'production';
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
});

afterAll(() => {
  env.NODE_ENV = originalEnv.NODE_ENV;
  if (originalEnv.UPSTASH_REDIS_REST_URL === undefined) delete process.env.UPSTASH_REDIS_REST_URL;
  else process.env.UPSTASH_REDIS_REST_URL = originalEnv.UPSTASH_REDIS_REST_URL;
  if (originalEnv.UPSTASH_REDIS_REST_TOKEN === undefined) delete process.env.UPSTASH_REDIS_REST_TOKEN;
  else process.env.UPSTASH_REDIS_REST_TOKEN = originalEnv.UPSTASH_REDIS_REST_TOKEN;
  global.fetch = realFetch;
});

describe('Rate limiting — dependency outage is NOT a quota breach', () => {
  it('1. production + financial + Redis config absent -> unavailable (not limited)', async () => {
    const r = await checkRateLimit('user-a', FINANCIAL_CONFIG);
    expect(r.allowed).toBe(false);
    expect(r.reason).toBe('unavailable');
  });

  it('1b. URL present but TOKEN missing (current prod state) -> unavailable', async () => {
    process.env.UPSTASH_REDIS_REST_URL = 'https://example.upstash.io';
    const r = await checkRateLimit('user-a', FINANCIAL_CONFIG);
    expect(r.allowed).toBe(false);
    expect(r.reason).toBe('unavailable');
  });

  it('2. invalid token (Upstash answers non-OK) -> unavailable', async () => {
    process.env.UPSTASH_REDIS_REST_URL = 'https://example.upstash.io';
    process.env.UPSTASH_REDIS_REST_TOKEN = 'bad-token';
    mockFetch(async () => httpError(401));
    const r = await checkRateLimit('user-a', FINANCIAL_CONFIG);
    expect(r.allowed).toBe(false);
    expect(r.reason).toBe('unavailable');
  });

  it('3. Redis unreachable (fetch rejects) -> unavailable, never a free pass', async () => {
    process.env.UPSTASH_REDIS_REST_URL = 'https://example.upstash.io';
    process.env.UPSTASH_REDIS_REST_TOKEN = 'good-token';
    mockFetch(async () => {
      throw new Error('network down');
    });
    const r = await checkRateLimit('user-a', FINANCIAL_CONFIG);
    expect(r.allowed).toBe(false);
    expect(r.reason).toBe('unavailable');
  });

  it('4. working Redis, real quota exceeded -> limited (true 429)', async () => {
    process.env.UPSTASH_REDIS_REST_URL = 'https://example.upstash.io';
    process.env.UPSTASH_REDIS_REST_TOKEN = 'good-token';
    let n = 0;
    mockFetch(async () => okJson(++n)); // INCR returns 1,2,3,4 -> 4 > max 3
    const results: RateLimitResult[] = [];
    for (let i = 0; i < 4; i++) results.push(await checkRateLimit('user-a', FINANCIAL_CONFIG));
    expect(results[0].allowed).toBe(true);
    expect(results[3].allowed).toBe(false);
    expect(results[3].reason).toBe('limited');
  });

  it('5. non-financial endpoint with no Redis falls back to memory (never unavailable)', async () => {
    const r = await checkRateLimit('user-a', NON_FINANCIAL_CONFIG);
    expect(r.allowed).toBe(true);
    expect(r.reason).toBe('ok');
  });

  it('6. retry after the window expires is allowed again (quota resets)', async () => {
    jest.useFakeTimers();
    try {
      jest.setSystemTime(new Date('2026-01-01T00:00:00Z'));
      const cfg = { windowMs: 60_000, max: 1, keyPrefix: 'test:window:' };
      expect((await checkRateLimit('u', cfg)).allowed).toBe(true);
      expect((await checkRateLimit('u', cfg)).allowed).toBe(false);
      jest.setSystemTime(new Date('2026-01-01T00:02:00Z')); // past the window
      expect((await checkRateLimit('u', cfg)).allowed).toBe(true);
    } finally {
      jest.useRealTimers();
    }
  });

  it('7. two distinct users have independent quotas', async () => {
    const cfg = { windowMs: 60_000, max: 1, keyPrefix: 'test:users:' };
    expect((await checkRateLimit('alice', cfg)).allowed).toBe(true);
    expect((await checkRateLimit('alice', cfg)).allowed).toBe(false);
    expect((await checkRateLimit('bob', cfg)).allowed).toBe(true); // unaffected by alice
  });

  it('12. financial prefixes stay protected in production without Redis (no bypass)', async () => {
    for (const cfg of [
      RATE_LIMIT_CONFIGS.orderCreate,
      RATE_LIMIT_CONFIGS.paymentInitiate,
      RATE_LIMIT_CONFIGS.paymentConfirm,
      RATE_LIMIT_CONFIGS.orderRecovery,
    ]) {
      const r = await checkRateLimit('x', cfg);
      expect(r.allowed).toBe(false);
      expect(r.reason).toBe('unavailable');
    }
  });
});

describe('rateLimitResponse — correct HTTP status per cause', () => {
  it('returns null (no response) when allowed', () => {
    expect(rateLimitResponse({ allowed: true, remaining: 5, retryAfterMs: 0, reason: 'ok' })).toBeNull();
  });

  it('maps a real quota breach to 429 with Retry-After', () => {
    const res = rateLimitResponse({ allowed: false, remaining: 0, retryAfterMs: 30_000, reason: 'limited' })!;
    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toBe('30');
  });

  it('maps a dependency outage to 503 (not 429) with Retry-After', () => {
    const res = rateLimitResponse({ allowed: false, remaining: 0, retryAfterMs: 60_000, reason: 'unavailable' })!;
    expect(res.status).toBe(503);
    expect(res.headers.get('Retry-After')).toBe('60');
  });

  it('503 message is user-facing and leaks no configuration detail', async () => {
    const res = rateLimitResponse({ allowed: false, remaining: 0, retryAfterMs: 60_000, reason: 'unavailable' })!;
    const body = await res.json();
    expect(body.error).toMatch(/indisponible/i);
    expect(body.error).not.toMatch(/upstash|redis|token|url|fail-closed|config/i);
  });

  it('429 message tells the user to retry, without config detail', async () => {
    const res = rateLimitResponse({ allowed: false, remaining: 0, retryAfterMs: 45_000, reason: 'limited' })!;
    const body = await res.json();
    expect(body.error).toMatch(/Trop de requêtes/i);
    expect(body.error).toContain('45');
    expect(body.error).not.toMatch(/upstash|redis|token/i);
  });
});

describe('Route + checkout wiring (source assertions)', () => {
  const read = (p: string) => fs.readFileSync(path.join(process.cwd(), p), 'utf8');

  const financialRoutes = [
    'src/app/api/orders/route.ts',
    'src/app/api/payment/initiate/route.ts',
    'src/app/api/payment/confirm/route.ts',
    'src/app/api/order/recovery/route.ts',
    'src/app/api/payment/kkiapay/verify/route.ts',
    'src/app/api/payment/webhook/route.ts',
  ];

  it.each(financialRoutes)('%s routes rate-limit decisions through the shared helper', (p) => {
    const route = read(p);
    expect(route).toMatch(/rateLimitResponse/);
    // Must no longer hand-roll a blanket 429 for every block reason.
    expect(route).not.toMatch(/status: 429,\s*headers:\s*\{\s*'Retry-After'/);
  });

  it('orders route checks the rate limit BEFORE creating an order (no dupes on 429)', () => {
    const route = read('src/app/api/orders/route.ts');
    const rlIndex = route.indexOf('checkRateLimit');
    const createIndex = route.indexOf("rpc('create_order'");
    expect(rlIndex).toBeGreaterThan(-1);
    expect(createIndex).toBeGreaterThan(rlIndex);
  });

  it('orders route dedupes via the Idempotency-Key header', () => {
    const route = read('src/app/api/orders/route.ts');
    expect(route).toMatch(/idempotency-key/i);
    expect(route).toMatch(/checkIdempotencyKey/);
    expect(route).toMatch(/storeIdempotencyResponse/);
  });

  it('checkout reuses a payload-stable idempotency token (no per-click regeneration)', () => {
    const page = read('src/app/checkout/page.tsx');
    // The token must come from a ref, not be minted inside handleSubmit.
    expect(page).toMatch(/idempotencyTokenRef\.current/);
    expect(page).toMatch(/idempotencyTokenRef\s*=\s*useRef/);
    // handleSubmit must not call randomUUID directly anymore.
    const submit = page.slice(page.indexOf('const handleSubmit'));
    expect(submit).not.toMatch(/randomUUID/);
  });

  it('checkout disables the submit button while a request is in flight', () => {
    const page = read('src/app/checkout/page.tsx');
    expect(page).toMatch(/disabled=\{loading/);
  });
});
