import { checkRateLimit, RATE_LIMIT_CONFIGS, cleanupMemoryStore } from '@/lib/rate-limit';

describe('Security: Rate Limiting', () => {
  beforeEach(() => {
    cleanupMemoryStore();
  });

  it('allows requests under limit', async () => {
    const config = { windowMs: 60000, max: 3, keyPrefix: 'test:under:' };
    const key = 'user-under-' + Date.now();

    const r1 = await checkRateLimit(key, config);
    expect(r1.allowed).toBe(true);

    const r2 = await checkRateLimit(key, config);
    expect(r2.allowed).toBe(true);

    const r3 = await checkRateLimit(key, config);
    expect(r3.allowed).toBe(true);
  });

  it('blocks requests over limit', async () => {
    const config = { windowMs: 60000, max: 2, keyPrefix: 'test:over:' };
    const key = 'user-over-' + Date.now();

    const r1 = await checkRateLimit(key, config);
    expect(r1.allowed).toBe(true);

    const r2 = await checkRateLimit(key, config);
    expect(r2.allowed).toBe(true);

    const r3 = await checkRateLimit(key, config);
    expect(r3.allowed).toBe(false);
    expect(r3.retryAfterMs).toBeGreaterThan(0);
  });

  it('tracks remaining count', async () => {
    const config = { windowMs: 60000, max: 5, keyPrefix: 'test:remain:' };
    const key = 'user-remain-' + Date.now();

    const r1 = await checkRateLimit(key, config);
    expect(r1.remaining).toBe(4);

    const r2 = await checkRateLimit(key, config);
    expect(r2.remaining).toBe(3);
  });

  it('different keys are independent', async () => {
    const config = { windowMs: 60000, max: 1, keyPrefix: 'test:indep:' };
    const key1 = 'user-indep-a-' + Date.now();
    const key2 = 'user-indep-b-' + Date.now();

    const r1 = await checkRateLimit(key1, config);
    expect(r1.allowed).toBe(true);

    const r2 = await checkRateLimit(key2, config);
    expect(r2.allowed).toBe(true);

    // key1 should now be blocked
    const r3 = await checkRateLimit(key1, config);
    expect(r3.allowed).toBe(false);
  });

  it('paymentConfirm config has strict limits', () => {
    expect(RATE_LIMIT_CONFIGS.paymentConfirm.max).toBeLessThanOrEqual(10);
    expect(RATE_LIMIT_CONFIGS.paymentConfirm.windowMs).toBe(60_000);
  });

  it('paymentWebhook config is generous for retries', () => {
    expect(RATE_LIMIT_CONFIGS.paymentWebhook.max).toBeGreaterThanOrEqual(50);
  });
});
