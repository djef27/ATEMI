/** @jest-environment node */

import { NextRequest } from 'next/server';
import { POST } from '../route';
import { PATCH } from '../[id]/route';

let mockSupabase: { from: jest.Mock };

jest.mock('@/lib/auth-helpers', () => ({
  withAdminAuth: (handler: (request: NextRequest, context: { supabase: typeof mockSupabase; params: Promise<Record<string, string>> }) => Promise<unknown>) =>
    (request: NextRequest, context: { params: Promise<Record<string, string>> }) =>
      handler(request, { supabase: mockSupabase, params: context.params }),
}));

function createRequest(url: string, method: string, body: unknown) {
  return new NextRequest(url, {
    method,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('admin delivery zone duplicate handling', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 409 when a concurrent create hits the database unique constraint', async () => {
    const duplicateLookup = {
      eq: jest.fn().mockReturnThis(),
      then: (resolve: (result: unknown) => unknown) =>
        Promise.resolve({ data: [], error: null }).then(resolve),
    };
    const insert = {
      select: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: null, error: { code: '23505' } }),
    };
    mockSupabase = {
      from: jest.fn(() => ({
        select: jest.fn(() => duplicateLookup),
        insert: jest.fn(() => insert),
      })),
    };

    const response = await POST(
      createRequest('http://localhost/api/admin/delivery-zones', 'POST', {
        country: 'GH',
        city: 'Accra',
        zone_name: 'Osu',
        delivery_fee: 0,
      }),
      { params: Promise.resolve({}) }
    );

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      success: false,
      error: 'Cette ville contient déjà une zone identique',
    });
  });

  it('rejects a zone name that differs only by letter case', async () => {
    const duplicateLookup = {
      eq: jest.fn().mockReturnThis(),
      then: (resolve: (result: unknown) => unknown) =>
        Promise.resolve({
          data: [{ id: 'existing-zone', city: 'Cotonou', zone_name: 'centre-ville' }],
          error: null,
        }).then(resolve),
    };
    const insert = jest.fn();
    mockSupabase = {
      from: jest.fn(() => ({
        select: jest.fn(() => duplicateLookup),
        insert,
      })),
    };

    const response = await POST(
      createRequest('http://localhost/api/admin/delivery-zones', 'POST', {
        country: 'BJ',
        city: 'Cotonou',
        zone_name: 'Centre-Ville',
        delivery_fee: 1000,
      }),
      { params: Promise.resolve({}) }
    );

    expect(response.status).toBe(409);
    expect(insert).not.toHaveBeenCalled();
    expect(duplicateLookup.eq).toHaveBeenCalledWith('city_name_normalized', 'cotonou');
    expect(duplicateLookup.eq).toHaveBeenCalledWith('zone_name_normalized', 'centre-ville');
  });

  it('returns 409 when an edit conflicts with the database unique constraint', async () => {
    const existingZone = {
      id: '550e8400-e29b-41d4-a716-446655440001',
      country: 'BJ',
      city: 'Cotonou',
      zone_name: 'Centre',
    };
    const existingLookup = {
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: existingZone, error: null }),
    };
    const conflictLookup = {
      eq: jest.fn().mockReturnThis(),
      neq: jest.fn().mockReturnThis(),
      then: (resolve: (result: unknown) => unknown) =>
        Promise.resolve({ data: [], error: null }).then(resolve),
    };
    const update = {
      eq: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: null, error: { code: '23505' } }),
    };
    let selectCount = 0;
    mockSupabase = {
      from: jest.fn(() => ({
        select: jest.fn(() => {
          selectCount += 1;
          return selectCount === 1 ? existingLookup : conflictLookup;
        }),
        update: jest.fn(() => update),
      })),
    };

    const response = await PATCH(
      createRequest(
        'http://localhost/api/admin/delivery-zones/550e8400-e29b-41d4-a716-446655440001',
        'PATCH',
        { zone_name: 'Akpakpa' }
      ),
      { params: Promise.resolve({ id: existingZone.id }) }
    );

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      success: false,
      error: 'Cette ville contient déjà une zone identique',
    });
  });
});
