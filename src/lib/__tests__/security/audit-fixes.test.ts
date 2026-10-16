import fs from 'fs';
import path from 'path';
import {
  computeDepositAmounts,
  sanitizeRedirect,
  escapeHtml,
} from '@/lib/utils';
import {
  isOrderStatusTerminal,
  canVendorUpdateStatus,
  getOrderStatusLabel,
  VENDOR_UPDATEABLE_STATUSES,
} from '@/lib/order-status';
import { getClientIp } from '@/lib/request';
import {
  groupCitiesByName,
  isUndefinedColumnError,
  normalizeCity,
} from '@/lib/delivery-zones';
import { deliveryZoneCreateSchema } from '@/lib/validations';

const read = (relative: string) =>
  fs.readFileSync(path.join(process.cwd(), relative), 'utf-8');

describe('computeDepositAmounts', () => {
  it('defaults to a 50% deposit when the rate is missing', () => {
    expect(computeDepositAmounts(10000, null)).toEqual({
      deposit_amount: 5000,
      remaining_amount: 5000,
    });
  });

  it('uses the provided rate', () => {
    expect(computeDepositAmounts(10000, 30)).toEqual({
      deposit_amount: 3000,
      remaining_amount: 7000,
    });
  });

  it('never produces a negative remaining amount for a valid rate', () => {
    const { deposit_amount, remaining_amount } = computeDepositAmounts(9999, 50);
    expect(deposit_amount + remaining_amount).toBe(9999);
    expect(remaining_amount).toBeGreaterThanOrEqual(0);
  });
});

describe('sanitizeRedirect', () => {
  it('keeps a same-origin path', () => {
    expect(sanitizeRedirect('/mes-commandes')).toBe('/mes-commandes');
  });

  it('rejects absolute, protocol-relative and backslash URLs', () => {
    expect(sanitizeRedirect('https://evil.tld')).toBe('/');
    expect(sanitizeRedirect('//evil.tld')).toBe('/');
    expect(sanitizeRedirect('/\\evil.tld')).toBe('/');
    expect(sanitizeRedirect('/\\/evil.tld')).toBe('/');
    expect(sanitizeRedirect('javascript:alert(1)')).toBe('/');
  });

  it('falls back for empty values and honours a custom fallback', () => {
    expect(sanitizeRedirect(null)).toBe('/');
    expect(sanitizeRedirect('', '/login')).toBe('/login');
    expect(sanitizeRedirect('https://evil.tld', '/login')).toBe('/login');
  });
});

describe('escapeHtml', () => {
  it('escapes the HTML-unsafe characters', () => {
    expect(escapeHtml('<script>alert("x")</script>')).toBe(
      '&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;'
    );
    expect(escapeHtml("Tom & Jerry's")).toBe('Tom &amp; Jerry&#39;s');
  });

  it('escapes & first so ampersands are not double-encoded', () => {
    expect(escapeHtml('<a>')).toBe('&lt;a&gt;');
    expect(escapeHtml('&lt;')).toBe('&amp;lt;');
  });

  it('renders null/undefined as an empty string', () => {
    expect(escapeHtml(null)).toBe('');
    expect(escapeHtml(undefined)).toBe('');
  });
});

describe('order status guards and labels', () => {
  it('treats cancelled/failed/completed as terminal', () => {
    expect(isOrderStatusTerminal('cancelled')).toBe(true);
    expect(isOrderStatusTerminal('failed')).toBe(true);
    expect(isOrderStatusTerminal('completed')).toBe(true);
    expect(isOrderStatusTerminal('confirmed')).toBe(false);
  });

  it('never lets a vendor rewind a delivered or closed order', () => {
    expect(canVendorUpdateStatus('confirmed')).toBe(true);
    expect(canVendorUpdateStatus('vendor_processing')).toBe(true);
    expect(canVendorUpdateStatus('delivered')).toBe(false);
    expect(canVendorUpdateStatus('out_for_delivery')).toBe(false);
    expect(canVendorUpdateStatus('cancelled')).toBe(false);
  });

  it('only offers forward vendor steps', () => {
    expect(VENDOR_UPDATEABLE_STATUSES).toEqual(['vendor_processing', 'ready_for_delivery']);
  });

  it('labels a completed order as terminal, not pending', () => {
    expect(getOrderStatusLabel('completed')).toBe('Terminée');
    expect(getOrderStatusLabel('cancelled')).toBe('Annulée');
    expect(getOrderStatusLabel('unknown-status')).toBe('Statut inconnu');
  });
});

// Minimal Headers stub: avoids depending on the `Headers` global being present
// in the jsdom test environment.
const fakeRequest = (headers: Record<string, string>) => {
  const lower = Object.fromEntries(
    Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value])
  );
  return {
    headers: { get: (name: string) => lower[name.toLowerCase()] ?? null },
  } as unknown as Parameters<typeof getClientIp>[0];
};

describe('getClientIp (rate-limit key)', () => {
  it('uses only the Vercel platform-provided IP, not client-supplied forwarding headers', () => {
    expect(getClientIp(fakeRequest({
      'x-vercel-forwarded-for': '9.9.9.9',
      'x-forwarded-for': '1.2.3.4, 8.8.8.8',
    }))).toBe('9.9.9.9');
  });

  it('does not assume that x-forwarded-for is trusted when platform provenance is unknown', () => {
    expect(getClientIp(fakeRequest({ 'x-forwarded-for': '5.5.5.5' }))).toBe('anonymous');
  });

  it('prefers the Vercel-provided IP and rejects malformed values', () => {
    expect(getClientIp(fakeRequest({
      'x-vercel-forwarded-for': '203.0.113.10',
      'x-forwarded-for': '198.51.100.4, 198.51.100.9',
    }))).toBe('203.0.113.10');
    expect(getClientIp(fakeRequest({
      'x-vercel-forwarded-for': 'not-an-ip',
      'x-forwarded-for': '198.51.100.4, 198.51.100.9',
    }))).toBe('anonymous');
    expect(getClientIp(fakeRequest({ 'x-real-ip': 'malformed' }))).toBe('anonymous');
    expect(getClientIp(fakeRequest({ 'x-real-ip': '9.9.9.9' }))).toBe('anonymous');
  });

  it("collapses missing headers to 'anonymous' instead of trusting a blank value", () => {
    expect(getClientIp(fakeRequest({}))).toBe('anonymous');
    expect(getClientIp(fakeRequest({ 'x-forwarded-for': '   ' }))).toBe('anonymous');
  });
});

describe('delivery zone helpers', () => {
  it('detects the 42703 undefined-column error code', () => {
    expect(isUndefinedColumnError({ code: '42703' })).toBe(true);
    expect(isUndefinedColumnError({ code: '42501' })).toBe(false);
    expect(isUndefinedColumnError(null)).toBe(false);
  });

  it('groups rows by city keeping the minimum fee', () => {
    expect(
      groupCitiesByName([
        { city: 'Cotonou', delivery_fee: 2000 },
        { city: 'Cotonou', delivery_fee: 1500 },
        { city: 'Comè', delivery_fee: 3000 },
      ])
    ).toEqual([
      { name: 'Comè', min_fee: 3000, zones_count: 1 },
      { name: 'Cotonou', min_fee: 1500, zones_count: 2 },
    ]);
  });

  it('uppercases and validates the country on create', () => {
    const result = deliveryZoneCreateSchema.safeParse({
      country: 'bj',
      city: 'Cotonou',
      zone_name: 'Akpakpa',
      delivery_fee: 2000,
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.country).toBe('BJ');
  });

  it('still rejects an over-long country code', () => {
    const result = deliveryZoneCreateSchema.safeParse({
      country: 'BENIN',
      city: 'Cotonou',
      zone_name: 'Akpakpa',
      delivery_fee: 2000,
    });
    expect(result.success).toBe(false);
  });

  it('normalises a city the same way the SQL generated column does', () => {
    expect(normalizeCity('  Comè ')).toBe('come');
  });
});

describe('SQL migration hardening (source assertions)', () => {
  it('keeps the corrected delivery_balance (total - deposit, includes fee)', () => {
    const migration = read(
      'supabase/migrations/20260911120000_payment_provider_and_sync.sql'
    );
    expect(migration).toMatch(/v_delivery_balance\s*:=\s*v_total\s*-\s*v_deposit/i);
    expect(migration).not.toMatch(/v_delivery_balance\s*:=\s*v_subtotal\s*-\s*v_deposit/i);
  });

  it('locks products in a deterministic order and never uses a set-returning call in an IF', () => {
    const migration = read(
      'supabase/migrations/20260930000000_create_order_and_rls_hardening.sql'
    );
    expect(migration).toMatch(/order by p\.id\s+for update/i);
    expect(migration).not.toMatch(/jsonb_array_elements\s*\(\s*p_items\s*\)\s+is null/i);
    expect(migration).toMatch(/jsonb_array_length\(p_items\)/i);
  });

  it('never assigns a uuid product id to a jsonb loop variable (cast trap)', () => {
    const migration = read(
      'supabase/migrations/20260930000000_create_order_and_rls_hardening.sql'
    );
    expect(migration).toMatch(/v_locked_product_id\s+uuid/i);
    expect(migration).toMatch(/for v_locked_product_id in/i);
  });

  it('adds orders.vendor_id defensively and backfills mono-vendor orders', () => {
    const migration = read(
      'supabase/migrations/20260930000000_create_order_and_rls_hardening.sql'
    );
    expect(migration).toMatch(/ADD COLUMN IF NOT EXISTS vendor_id/i);
    expect(migration).toMatch(/HAVING COUNT\(DISTINCT oi\.vendor_id\) = 1/i);
  });
});

describe('route-level integration (source assertions)', () => {
  it.each([
    'src/app/api/payment/webhook/route.ts',
    'src/app/api/orders/route.ts',
    'src/app/api/newsletter/route.ts',
    'src/app/api/contact/route.ts',
    'src/app/api/products/stock/route.ts',
  ])('%s uses the shared trusted client IP helper for rate limiting', (routePath) => {
    const route = read(routePath);
    expect(route).toMatch(/getClientIp\(request\)/);
    expect(route).not.toMatch(/x-forwarded-for.*split\(\s*['"],['"]\s*\)\[0\]/);
  });

  it.each([
    ['src/app/api/newsletter/route.ts', 'Impossible d’enregistrer votre inscription. Réessayez plus tard.'],
    ['src/app/api/contact/route.ts', 'Impossible d’envoyer votre message. Réessayez plus tard.'],
  ])('%s reports database write failures instead of returning success', (routePath, errorMessage) => {
    const route = read(routePath);
    expect(route).toContain('if (insertError)');
    expect(route).toContain(errorMessage);
    expect(route).toMatch(/status: 500/);
  });

  it('order confirmation email uses server-computed totals, not client math', () => {
    const route = read('src/app/api/orders/route.ts');
    expect(route).toMatch(/orderData\.deposit_amount/);
    expect(route).toMatch(/orderData\.delivery_balance/);
    expect(route).not.toMatch(/Math\.round\(price \* rate \/ 100\)/);
  });

  it('payment initiation refuses terminal orders and uses the shared IP helper', () => {
    const route = read('src/app/api/payment/initiate/route.ts');
    expect(route).toMatch(/isOrderStatusTerminal/);
    expect(route).toMatch(/getClientIp\(request\)/);
  });

  it('protects the notification pending count with active admin authentication', () => {
    const route = read('src/app/api/notifications/dispatch/route.ts');
    const getHandler = route.slice(route.indexOf('export async function GET'));
    expect(getHandler).toContain('requireAdminAuth(request)');
    expect(getHandler).toContain("if ('error' in auth) return auth.error;");
    expect(getHandler).toContain('const supabase = auth.supabase;');
    expect(getHandler).toContain("request.headers.get('authorization')");
    expect(getHandler).toContain('dispatchPendingNotifications({ supabase })');
  });

  it('restricts session-based notification dispatch to same-origin active admins', () => {
    const route = read('src/app/api/notifications/dispatch/route.ts');
    expect(route).toContain('if (!isAllowedOrigin(request))');
    expect(route).toContain("isAdmin = profile?.role === 'admin' && profile.is_active;");
  });
});
