/** @jest-environment node */

import { orderRecoverySchema } from '@/lib/validations';
import { RATE_LIMIT_CONFIGS, checkRateLimit } from '@/lib/rate-limit';
import { createAdminSupabaseClient } from '@/lib/supabase/server';
import { getClientIp } from '@/lib/request';
import { POST as recoverOrder } from '@/app/api/order/recovery/route';
import { NextRequest } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';

jest.mock('@/lib/supabase/server', () => ({
  createAdminSupabaseClient: jest.fn(),
}));

jest.mock('@/lib/request', () => ({
  getClientIp: jest.fn(),
}));

jest.mock('@/lib/rate-limit', () => ({
  ...jest.requireActual('@/lib/rate-limit'),
  checkRateLimit: jest.fn(),
}));

const adminClientMock = createAdminSupabaseClient as jest.MockedFunction<typeof createAdminSupabaseClient>;
const rateLimitMock = checkRateLimit as jest.MockedFunction<typeof checkRateLimit>;
const clientIpMock = getClientIp as jest.MockedFunction<typeof getClientIp>;

function makeRecoveryRequest(body: unknown) {
  return new NextRequest('http://localhost/api/order/recovery', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function makeOrderQuery(result: unknown) {
  const query = {
    select: jest.fn(),
    eq: jest.fn(),
    maybeSingle: jest.fn().mockResolvedValue(result),
  };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  return query;
}

describe('Order recovery — route execution', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clientIpMock.mockReturnValue('203.0.113.10');
    rateLimitMock.mockResolvedValue({ allowed: true, remaining: 4, retryAfterMs: 0, reason: 'ok' });
  });

  it('returns the matching guest order through the server-side admin client', async () => {
    const order = {
      order_number: 'ATM-20261011-ABC12345',
      tracking_token: 'tracking-token',
      status: 'confirmed',
      total_amount: 10000,
      deposit_amount: 5000,
      delivery_balance: 5000,
      delivery_city: 'Cotonou',
      created_at: '2026-10-11T10:00:00.000Z',
    };
    const query = makeOrderQuery({ data: order, error: null });
    adminClientMock.mockReturnValue({
      from: jest.fn(() => query),
    } as unknown as ReturnType<typeof createAdminSupabaseClient>);

    const response = await recoverOrder(makeRecoveryRequest({
      order_number: order.order_number,
      email: 'Client@Exemple.COM',
    }));

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload).toEqual({
      found: true,
      ...order,
      currency: 'XOF',
    });
    // Minimal disclosure: the route must not leak PII it never renders.
    expect(payload).not.toHaveProperty('customer_name');
    expect(payload).not.toHaveProperty('customer_phone');
    expect(payload).not.toHaveProperty('customer_email');
    expect(rateLimitMock).toHaveBeenCalledWith(
      'ip:203.0.113.10',
      RATE_LIMIT_CONFIGS.orderRecovery
    );
    expect(query.eq).toHaveBeenNthCalledWith(1, 'order_number', order.order_number);
    expect(query.eq).toHaveBeenNthCalledWith(2, 'customer_email', 'client@exemple.com');
  });

  it('rejects rate-limited requests before querying orders', async () => {
    rateLimitMock.mockResolvedValue({ allowed: false, remaining: 0, retryAfterMs: 15000, reason: 'limited' });

    const response = await recoverOrder(makeRecoveryRequest({
      order_number: 'ATM-20261011-ABC12345',
      email: 'client@example.com',
    }));

    expect(response.status).toBe(429);
    expect(response.headers.get('Retry-After')).toBe('15');
    expect(adminClientMock).not.toHaveBeenCalled();
  });

  it('returns a generic server error when the database lookup fails', async () => {
    const log = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const query = makeOrderQuery({
      data: null,
      error: { message: 'internal database details' },
    });
    adminClientMock.mockReturnValue({
      from: jest.fn(() => query),
    } as unknown as ReturnType<typeof createAdminSupabaseClient>);

    const response = await recoverOrder(makeRecoveryRequest({
      order_number: 'ATM-20261011-ABC12345',
      email: 'client@example.com',
    }));

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: 'Erreur interne du serveur',
    });
    expect(JSON.stringify(log.mock.calls)).not.toContain('client@example.com');
    log.mockRestore();
  });
});

/**
 * Order recovery (email + order number) security tests.
 *
 * The guest lookup used to call the SECURITY DEFINER RPC get_order_by_email()
 * directly from the browser. It now goes through a rate-limited server route.
 */
describe('Order recovery — payload validation', () => {
  it('accepts a valid order number + email', () => {
    const result = orderRecoverySchema.safeParse({
      order_number: 'ATM-20261011-ABC12345',
      email: 'Client@Exemple.COM',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.order_number).toBe('ATM-20261011-ABC12345');
      expect(result.data.email).toBe('Client@Exemple.COM');
    }
  });

  it('rejects a missing order number', () => {
    const result = orderRecoverySchema.safeParse({ email: 'client@exemple.com' });
    expect(result.success).toBe(false);
  });

  it('rejects an invalid email', () => {
    const result = orderRecoverySchema.safeParse({
      order_number: 'ATM-20261011-ABC12345',
      email: 'pas-un-email',
    });
    expect(result.success).toBe(false);
  });

  it('rejects an empty payload', () => {
    const result = orderRecoverySchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

describe('Order recovery — rate limiting', () => {
  it('has a strict dedicated rate-limit config (per IP)', () => {
    expect(RATE_LIMIT_CONFIGS.orderRecovery).toBeDefined();
    expect(RATE_LIMIT_CONFIGS.orderRecovery.max).toBeLessThanOrEqual(5);
    expect(RATE_LIMIT_CONFIGS.orderRecovery.windowMs).toBe(900_000);
    expect(RATE_LIMIT_CONFIGS.orderRecovery.keyPrefix).toContain('rl:order:');
  });
});

describe('Order recovery — route contract', () => {
  const route = fs.readFileSync(
    path.join(process.cwd(), 'src/app/api/order/recovery/route.ts'),
    'utf-8'
  );

  it('is served by the admin client (server-only lookup)', () => {
    expect(route).toContain('createAdminSupabaseClient');
    expect(route).toContain(".from('orders')");
    // The route never invokes the old browser RPC directly.
    expect(route).not.toMatch(/rpc\(['"]get_order_by_email/);
  });

  it('rate-limits by client IP', () => {
    expect(route).toContain('getClientIp');
    expect(route).toContain('RATE_LIMIT_CONFIGS.orderRecovery');
  });

  it('returns a generic not-found and rejects non-POST methods', () => {
    expect(route).toContain('Commande non trouvée');
    expect(route).toContain('Méthode non autorisée');
  });

  it('returns the same shape as the legacy RPC (tracking_token included)', () => {
    expect(route).toContain('tracking_token');
    expect(route).toContain('delivery_balance');
    expect(route).toContain('found: true');
    expect(route).toContain('currency');
  });
});

describe('Order recovery — RPC privileges', () => {
  const migration = fs.readFileSync(
    path.join(process.cwd(), 'supabase/migrations/20261011120000_restrict_order_email_recovery.sql'),
    'utf-8'
  );
  const migrationStatements = migration.replace(/--.*$/gm, '');

  it('restricts the sensitive lookup RPC to the server service role', () => {
    expect(migration).toMatch(
      /REVOKE ALL ON FUNCTION public\.get_order_by_email\(TEXT, TEXT\) FROM PUBLIC, anon, authenticated;/i
    );
    expect(migration).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.get_order_by_email\(TEXT, TEXT\) TO service_role;/i
    );
    expect(migrationStatements).not.toMatch(
      /GRANT EXECUTE ON FUNCTION public\.get_order_by_email\([\s\S]*?\) TO authenticated;/i
    );
    expect(migrationStatements).toMatch(
      /has_function_privilege\('public', 'public\.get_order_by_email\(text,text\)', 'EXECUTE'\)/i
    );
    expect(migrationStatements).toMatch(
      /has_function_privilege\('anon', 'public\.get_order_by_email\(text,text\)', 'EXECUTE'\)/i
    );
    expect(migrationStatements).toMatch(
      /has_function_privilege\('authenticated', 'public\.get_order_by_email\(text,text\)', 'EXECUTE'\)/
    );
    expect(migrationStatements).toMatch(
      /has_function_privilege\('service_role', 'public\.get_order_by_email\(text,text\)', 'EXECUTE'\)/
    );
  });
});

describe('Order recovery — suivi page migration', () => {
  const page = fs.readFileSync(
    path.join(process.cwd(), 'src/app/suivi/page.tsx'),
    'utf-8'
  );

  it('no longer calls the browser RPC get_order_by_email', () => {
    expect(page).not.toContain('get_order_by_email');
  });

  it('calls the server recovery route', () => {
    expect(page).toContain("'/api/order/recovery'");
  });

  it('keeps the token lookup via RPC', () => {
    expect(page).toContain("get_order_tracking");
  });

  it('renders delivery_city for email recovery results', () => {
    expect(page).toContain('delivery_city');
    expect(page).toContain('delivery_balance');
  });
});