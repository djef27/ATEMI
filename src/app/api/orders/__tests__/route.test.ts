/** @jest-environment node */

import { NextRequest } from 'next/server';
import { POST } from '@/app/api/orders/route';
import { createAdminSupabaseClient, createServerSupabaseClient } from '@/lib/supabase/server';
import { checkRateLimit } from '@/lib/rate-limit';
import { checkIdempotencyKey, storeIdempotencyResponse } from '@/lib/idempotency';

jest.mock('@/lib/supabase/server', () => ({
  createAdminSupabaseClient: jest.fn(),
  createServerSupabaseClient: jest.fn(),
}));

jest.mock('@/lib/rate-limit', () => ({
  checkRateLimit: jest.fn(),
  RATE_LIMIT_CONFIGS: { orderCreate: {} },
}));

jest.mock('@/lib/api-rate-limit', () => ({
  rateLimitResponse: jest.fn(() => null),
}));

jest.mock('@/lib/request', () => ({
  getClientIp: jest.fn(() => '203.0.113.8'),
}));

jest.mock('@/lib/payment/config', () => ({
  getPaymentConfig: jest.fn(() => ({ provider: 'kkiapay' })),
}));

jest.mock('@/lib/idempotency', () => ({
  checkIdempotencyKey: jest.fn(),
  generateRequestHash: jest.fn(() => 'request-hash'),
  getIdempotencyKey: jest.fn(() => 'order-idempotency-key'),
  storeIdempotencyResponse: jest.fn(),
}));

jest.mock('@/lib/email', () => ({
  sendEmail: jest.fn().mockResolvedValue(undefined),
  orderConfirmationEmail: jest.fn(),
}));

const zoneId = '550e8400-e29b-41d4-a716-446655440001';
const productId = '550e8400-e29b-41d4-a716-446655440002';
const orderId = '550e8400-e29b-41d4-a716-446655440003';
const trackingToken = '550e8400-e29b-41d4-a716-446655440004';
const validPayload = {
  customer_name: 'Jean Dupont',
  customer_phone: '+229 01 02 03 04',
  delivery_required: false,
  items: [{ product_id: productId, quantity: 1 }],
};

function createRequest(body: unknown) {
  return new NextRequest('http://localhost/api/orders', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function mockSuccessfulOrderCreation() {
  const rpc = jest.fn().mockResolvedValue({
    data: {
      success: true,
      order_id: orderId,
      order_number: 'CMD-20261105-123456-ABCDEF',
      tracking_token: trackingToken,
    },
    error: null,
  });
  const itemsQuery = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockResolvedValue({ data: [], error: null }),
  };
  (createAdminSupabaseClient as jest.Mock).mockReturnValue({
    from: jest.fn(() => itemsQuery),
    rpc,
  });
  (createServerSupabaseClient as jest.Mock).mockResolvedValue({
    auth: { getUser: jest.fn().mockResolvedValue({ data: { user: null }, error: null }) },
  });
  return rpc;
}

describe('POST /api/orders', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (checkRateLimit as jest.Mock).mockResolvedValue({
      allowed: true,
      remaining: 9,
      retryAfterMs: 0,
      reason: 'ok',
    });
    (checkIdempotencyKey as jest.Mock).mockResolvedValue({
      isNew: true,
      error: null,
      existingResponse: null,
    });
    (storeIdempotencyResponse as jest.Mock).mockResolvedValue(undefined);
  });

  it('creates the order when the selected city matches even if the generated SQL city index is stale', async () => {
    const zoneQuery = {
      select: jest.fn(),
      eq: jest.fn(),
      then: (resolve: (result: unknown) => unknown) => {
        const queriedGeneratedCity = zoneQuery.eq.mock.calls.some(
          ([column]) => column === 'city_normalized'
        );
        return Promise.resolve({
          data: queriedGeneratedCity
            ? []
            : [{ id: zoneId, city: 'Cotonou', zone_name: 'Agla', delivery_fee: 2000 }],
          error: null,
        }).then(resolve);
      },
    };
    zoneQuery.select.mockReturnValue(zoneQuery);
    zoneQuery.eq.mockReturnValue(zoneQuery);

    const rpc = jest.fn().mockResolvedValue({
      data: {
        success: true,
        order_id: orderId,
        order_number: 'CMD-20261105-123456-ABCDEF',
        tracking_token: trackingToken,
      },
      error: null,
    });
    (createAdminSupabaseClient as jest.Mock).mockReturnValue({
      from: jest.fn(() => zoneQuery),
      rpc,
    });
    (createServerSupabaseClient as jest.Mock).mockResolvedValue({
      auth: { getUser: jest.fn().mockResolvedValue({ data: { user: null }, error: null }) },
    });

    const response = await POST(new NextRequest('http://localhost/api/orders', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        customer_name: 'Jean Dupont',
        customer_phone: '+229 01 02 03 04',
        delivery_address: 'Rue de la Paix',
        delivery_city: 'Cotonou',
        delivery_zone_id: zoneId,
        delivery_required: true,
        country: 'BJ',
        items: [{ product_id: productId, quantity: 1 }],
      }),
    }));

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      success: true,
      data: { order_id: orderId, tracking_token: trackingToken },
    });
    expect(zoneQuery.eq).not.toHaveBeenCalledWith('city_normalized', expect.anything());
    expect(rpc).toHaveBeenCalledWith('create_order', expect.objectContaining({
      p_delivery_zone_id: zoneId,
      p_delivery_city: 'Cotonou',
    }));
  });

  it.each([
    ['béninois', '+229 01 02 03 04'],
    ['ivoirien', '+225 07 12 34 56 78'],
    ['togolais', '+228 90 12 34 56'],
    ['sénégalais', '+221 77 123 45 67'],
    ['international format exceeding 20 characters', '+233 1-23 456 789 012'],
  ])('accepts a valid phone number %s', async (_country, customer_phone) => {
    const rpc = mockSuccessfulOrderCreation();
    const response = await POST(createRequest({ ...validPayload, customer_phone }));

    expect(response.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith('create_order', expect.objectContaining({ p_customer_phone: customer_phone }));
  });

  it('accepts long and compound names, a maximum-length address, and a valid email', async () => {
    const rpc = mockSuccessfulOrderCreation();
    const customer_name = ('Jean-Baptiste ' + 'TrèsLongNom '.repeat(7)).trim().padEnd(100, 'X');
    const delivery_address = 'Quartier résidentiel, rue principale, porte 24, près du marché '.repeat(4).slice(0, 250);
    const customer_email = `${'a'.repeat(242)}@example.com`;
    const response = await POST(createRequest({
      ...validPayload,
      customer_name,
      customer_email,
      delivery_address,
      delivery_city: 'C'.repeat(100),
      customer_notes: 'I'.repeat(500),
    }));

    expect(response.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith('create_order', expect.objectContaining({
      p_customer_name: customer_name,
      p_customer_email: customer_email,
    }));
  });

  it.each([
    [{ customer_name: '' }, 'customer_name', 'Veuillez saisir votre nom complet.'],
    [{ customer_phone: '' }, 'customer_phone', 'Veuillez saisir un numéro de téléphone valide.'],
    [{ customer_email: 'not-an-email' }, 'customer_email', 'Veuillez saisir une adresse email valide.'],
  ])('returns a French field error for invalid required/contact data', async (overrides, field, error) => {
    const response = await POST(createRequest({ ...validPayload, ...overrides }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toMatchObject({ success: false, field, error });
    expect(createAdminSupabaseClient).not.toHaveBeenCalled();
  });

  it('rejects ISO-shaped codes absent from the trusted country dataset, including pickup orders', async () => {
    const response = await POST(createRequest({
      ...validPayload,
      country: 'ZZ',
    }));

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      success: false,
      field: 'country',
      error: 'Veuillez choisir un pays valide.',
    });
    expect(createAdminSupabaseClient).not.toHaveBeenCalled();
    expect(checkIdempotencyKey).not.toHaveBeenCalled();
  });

  it('associates missing delivery details with their corresponding fields', async () => {
    const response = await POST(createRequest({
      ...validPayload,
      delivery_required: true,
    }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toMatchObject({
      success: false,
      field: 'delivery_address',
      error: 'Adresse de livraison requise',
    });
    expect(createAdminSupabaseClient).not.toHaveBeenCalled();
  });

  it('rejects a delivery zone that does not match the selected country and city', async () => {
    const zoneQuery = {
      select: jest.fn(),
      eq: jest.fn(),
      then: (resolve: (result: unknown) => unknown) =>
        Promise.resolve({
          data: [{ id: zoneId, city: 'Cotonou', zone_name: 'Akpakpa', delivery_fee: 2000 }],
          error: null,
        }).then(resolve),
    };
    zoneQuery.select.mockReturnValue(zoneQuery);
    zoneQuery.eq.mockReturnValue(zoneQuery);
    (createAdminSupabaseClient as jest.Mock).mockReturnValue({
      from: jest.fn(() => zoneQuery),
      rpc: jest.fn(),
    });

    const response = await POST(createRequest({
      ...validPayload,
      delivery_required: true,
      delivery_address: 'Rue de la Paix',
      delivery_city: 'Lomé',
      delivery_zone_id: zoneId,
      country: 'TG',
    }));

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      success: false,
      error: 'Aucune zone de livraison disponible pour cette ville. Modifiez la ville ou choisissez le retrait.',
    });
    expect(zoneQuery.eq).toHaveBeenCalledWith('country', 'TG');
    expect(createServerSupabaseClient).not.toHaveBeenCalled();
  });

  it('passes the only matching active delivery zone to create_order when the client omits its id', async () => {
    const onlyZone = { id: zoneId, city: 'Cotonou', zone_name: 'Centre-Ville', delivery_fee: 1000 };
    const zoneQuery = {
      select: jest.fn(),
      eq: jest.fn(),
      then: (resolve: (result: unknown) => unknown) =>
        Promise.resolve({ data: [onlyZone], error: null }).then(resolve),
    };
    zoneQuery.select.mockReturnValue(zoneQuery);
    zoneQuery.eq.mockReturnValue(zoneQuery);
    const rpc = jest.fn().mockResolvedValue({
      data: {
        success: true,
        order_id: orderId,
        order_number: 'CMD-20261105-123456-ABCDEF',
        tracking_token: trackingToken,
      },
      error: null,
    });
    (createAdminSupabaseClient as jest.Mock).mockReturnValue({
      from: jest.fn(() => zoneQuery),
      rpc,
    });
    (createServerSupabaseClient as jest.Mock).mockResolvedValue({
      auth: { getUser: jest.fn().mockResolvedValue({ data: { user: null }, error: null }) },
    });

    const response = await POST(createRequest({
      ...validPayload,
      delivery_required: true,
      delivery_address: 'Rue de la Paix',
      delivery_city: 'Cotonou',
      country: 'BJ',
    }));

    expect(response.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith('create_order', expect.objectContaining({
      p_delivery_zone_id: zoneId,
      p_delivery_city: 'Cotonou',
    }));
  });

  it.each([
    [{ customer_name: 'N'.repeat(101) }, 'customer_name'],
    [{ customer_phone: '+229 1234567890123456' }, 'customer_phone'],
    [{ customer_phone: '+229 ABCD 1234' }, 'customer_phone'],
    [{ customer_phone: `+229 ${'1-'.repeat(10)}1` }, 'customer_phone'],
    [{ delivery_address: 'A'.repeat(251) }, 'delivery_address'],
    [{ delivery_city: 'C'.repeat(101) }, 'delivery_city'],
    [{ customer_notes: 'I'.repeat(501) }, 'customer_notes'],
  ])('rejects invalid or over-limit data before creating an order', async (overrides, field) => {
    const response = await POST(createRequest({ ...validPayload, ...overrides }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toMatchObject({ success: false, field });
    expect(createAdminSupabaseClient).not.toHaveBeenCalled();
  });
});
