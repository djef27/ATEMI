/** @jest-environment node */

import { NextRequest } from 'next/server';
import { GET } from '@/app/api/delivery-zones/route';
import { createAdminSupabaseClient } from '@/lib/supabase/server';
import { checkRateLimit } from '@/lib/rate-limit';

jest.mock('@/lib/supabase/server', () => ({
  createAdminSupabaseClient: jest.fn(),
}));

jest.mock('@/lib/rate-limit', () => ({
  checkRateLimit: jest.fn(),
  RATE_LIMIT_CONFIGS: { general: {} },
}));

jest.mock('@/lib/request', () => ({
  getClientIp: jest.fn(() => '203.0.113.8'),
}));

describe('GET /api/delivery-zones', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (checkRateLimit as jest.Mock).mockResolvedValue({
      allowed: true,
      remaining: 29,
      retryAfterMs: 0,
      reason: 'ok',
    });
  });

  it('finds city zones even when the generated normalized city value is stale', async () => {
    const query = {
      select: jest.fn(),
      eq: jest.fn(),
      order: jest.fn().mockResolvedValue({
        data: [
          { id: 'zone-1', city: 'Cotonou', zone_name: 'Akpakpa', delivery_fee: 2000 },
          { id: 'zone-2', city: 'Cotonou', zone_name: 'Centre-Ville', delivery_fee: 1000 },
          { id: 'zone-3', city: 'Porto-Novo', zone_name: 'Centre-Ville', delivery_fee: 1500 },
        ],
        error: null,
      }),
    };
    query.select.mockReturnValue(query);
    query.eq.mockReturnValue(query);

    (createAdminSupabaseClient as jest.Mock).mockReturnValue({
      from: jest.fn(() => query),
    });

    const response = await GET(
      new NextRequest('http://localhost/api/delivery-zones?city=cotonou&country=BJ')
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      success: true,
      data: [
        { id: 'zone-1', name: 'Akpakpa', fee: 2000, city: 'Cotonou' },
        { id: 'zone-2', name: 'Centre-Ville', fee: 1000, city: 'Cotonou' },
      ],
    });
    expect(query.eq).toHaveBeenCalledWith('country', 'BJ');
    expect(query.eq).not.toHaveBeenCalledWith('city_normalized', expect.anything());
    expect(createAdminSupabaseClient).toHaveBeenCalled();
  });

  it('returns only configured cities for the requested country', async () => {
    const query = {
      select: jest.fn(),
      eq: jest.fn(),
      order: jest.fn().mockResolvedValue({
        data: [{ id: 'zone-tg', city: 'Lomé', zone_name: 'Centre', delivery_fee: 1500 }],
        error: null,
      }),
    };
    query.select.mockReturnValue(query);
    query.eq.mockReturnValue(query);
    (createAdminSupabaseClient as jest.Mock).mockReturnValue({
      from: jest.fn(() => query),
    });

    const response = await GET(
      new NextRequest('http://localhost/api/delivery-zones?cities=1&country=TG')
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      success: true,
      data: [{ name: 'Lomé', min_fee: 1500, zones_count: 1, region_code: 'M' }],
    });
    expect(query.eq).toHaveBeenCalledWith('country', 'TG');
  });

  it('returns an empty city list when the selected country has no configured delivery zones', async () => {
    const query = {
      select: jest.fn(),
      eq: jest.fn(),
      order: jest.fn().mockResolvedValue({ data: [], error: null }),
    };
    query.select.mockReturnValue(query);
    query.eq.mockReturnValue(query);
    (createAdminSupabaseClient as jest.Mock).mockReturnValue({
      from: jest.fn(() => query),
    });

    const response = await GET(
      new NextRequest('http://localhost/api/delivery-zones?cities=1&country=SG')
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true, data: [] });
    expect(query.eq).toHaveBeenCalledWith('country', 'SG');
  });
});
