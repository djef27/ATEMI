/** @jest-environment node */

import { NextRequest, NextResponse } from 'next/server';
import { POST as submitContact } from '@/app/api/contact/route';
import { POST as subscribeNewsletter } from '@/app/api/newsletter/route';
import { GET as getNotifications, POST as dispatchNotifications } from '@/app/api/notifications/dispatch/route';
import { createAdminSupabaseClient, createServerSupabaseClient } from '@/lib/supabase/server';
import { dispatchPendingNotifications } from '@/lib/notifications/dispatcher';
import { checkRateLimit } from '@/lib/rate-limit';
import { getClientIp } from '@/lib/request';
import { isAllowedOrigin, requireAdminAuth } from '@/lib/auth-helpers';

jest.mock('@/lib/supabase/server', () => ({
  createAdminSupabaseClient: jest.fn(),
  createServerSupabaseClient: jest.fn(),
}));

jest.mock('@/lib/rate-limit', () => ({
  checkRateLimit: jest.fn(),
  RATE_LIMIT_CONFIGS: { general: {}, paymentWebhook: {}, orderCreate: {} },
}));

jest.mock('@/lib/request', () => ({ getClientIp: jest.fn() }));
jest.mock('@/lib/notifications/dispatcher', () => ({
  dispatchPendingNotifications: jest.fn(),
}));
jest.mock('@/lib/auth-helpers', () => ({
  isAllowedOrigin: jest.fn(),
  requireAdminAuth: jest.fn(),
}));

const adminClientMock = createAdminSupabaseClient as jest.MockedFunction<typeof createAdminSupabaseClient>;
const serverClientMock = createServerSupabaseClient as jest.MockedFunction<typeof createServerSupabaseClient>;
const rateLimitMock = checkRateLimit as jest.MockedFunction<typeof checkRateLimit>;
const clientIpMock = getClientIp as jest.MockedFunction<typeof getClientIp>;
const dispatchMock = dispatchPendingNotifications as jest.MockedFunction<typeof dispatchPendingNotifications>;
const allowedOriginMock = isAllowedOrigin as jest.MockedFunction<typeof isAllowedOrigin>;
const requireAdminMock = requireAdminAuth as jest.MockedFunction<typeof requireAdminAuth>;

const dispatchSummary = { claimed: 2, sent: 1, retried: 1, failed: 0 };
const originalCronSecret = process.env.CRON_SECRET;

function makeRequest(path: string, body?: unknown, headers: Record<string, string> = {}) {
  return new NextRequest(`http://localhost${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

function makeSupabaseQuery(result: unknown) {
  const query: {
    select: jest.Mock;
    eq: jest.Mock;
    insert: jest.Mock;
    upsert: jest.Mock;
    single: jest.Mock;
  } = {
    select: jest.fn(),
    eq: jest.fn(),
    insert: jest.fn().mockResolvedValue(result),
    upsert: jest.fn().mockResolvedValue(result),
    single: jest.fn().mockResolvedValue(result),
  };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  return query;
}

describe('contact and newsletter routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    rateLimitMock.mockResolvedValue({ allowed: true, remaining: 29, retryAfterMs: 0 });
    clientIpMock.mockReturnValue('203.0.113.8');
  });

  it('persists a contact message and preserves the success response contract', async () => {
    const query = makeSupabaseQuery({ error: null });
    const from = jest.fn(() => query);
    adminClientMock.mockReturnValue({ from } as unknown as ReturnType<typeof createAdminSupabaseClient>);

    const response = await submitContact(makeRequest('/api/contact', {
      name: 'Test User',
      email: 'test@example.com',
      subject: 'Question',
      message: 'A sufficiently long message.',
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ success: true });
    expect(from).toHaveBeenCalledWith('contact_messages');
    expect(query.insert).toHaveBeenCalledWith({
      name: 'Test User',
      email: 'test@example.com',
      subject: 'Question',
      message: 'A sufficiently long message.',
    });
  });

  it('returns an error, not success, when contact persistence fails', async () => {
    const query = makeSupabaseQuery({ error: { message: 'database unavailable' } });
    adminClientMock.mockReturnValue({ from: jest.fn(() => query) } as unknown as ReturnType<typeof createAdminSupabaseClient>);
    const log = jest.spyOn(console, 'error').mockImplementation(() => undefined);

    const response = await submitContact(makeRequest('/api/contact', {
      name: 'Test User',
      email: 'test@example.com',
      subject: 'Question',
      message: 'A sufficiently long message.',
    }));

    expect(response.status).toBe(500);
    expect(await response.json()).toMatchObject({ success: false });
    expect(log).toHaveBeenCalled();
    expect(JSON.stringify(log.mock.calls)).not.toContain('test@example.com');
    expect(JSON.stringify(log.mock.calls)).not.toContain('A sufficiently long message.');
    log.mockRestore();
  });

  it('returns a generic response when an unexpected contact error occurs', async () => {
    adminClientMock.mockImplementation(() => { throw new Error('internal detail'); });
    const log = jest.spyOn(console, 'error').mockImplementation(() => undefined);

    const response = await submitContact(makeRequest('/api/contact', {
      name: 'Test User',
      email: 'test@example.com',
      subject: 'Question',
      message: 'A sufficiently long message.',
    }));

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: 'Erreur interne du serveur',
    });
    expect(log).toHaveBeenCalled();
    log.mockRestore();
  });

  it('upserts a newsletter address and preserves the success response contract', async () => {
    const query = makeSupabaseQuery({ error: null });
    adminClientMock.mockReturnValue({ from: jest.fn(() => query) } as unknown as ReturnType<typeof createAdminSupabaseClient>);

    const response = await subscribeNewsletter(makeRequest('/api/newsletter', {
      email: 'test@example.com',
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ success: true });
    expect(query.upsert).toHaveBeenCalledWith(
      { email: 'test@example.com' },
      { onConflict: 'email', ignoreDuplicates: true }
    );
  });

  it('returns an error, not success, when newsletter persistence fails', async () => {
    const query = makeSupabaseQuery({ error: { message: 'database unavailable' } });
    adminClientMock.mockReturnValue({ from: jest.fn(() => query) } as unknown as ReturnType<typeof createAdminSupabaseClient>);
    const log = jest.spyOn(console, 'error').mockImplementation(() => undefined);

    const response = await subscribeNewsletter(makeRequest('/api/newsletter', {
      email: 'test@example.com',
    }));

    expect(response.status).toBe(500);
    expect(await response.json()).toMatchObject({ success: false });
    expect(log).toHaveBeenCalled();
    expect(JSON.stringify(log.mock.calls)).not.toContain('test@example.com');
    log.mockRestore();
  });
});

describe('notification dispatch route authorization', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.CRON_SECRET;
    allowedOriginMock.mockReturnValue(true);
    dispatchMock.mockResolvedValue(dispatchSummary);
    requireAdminMock.mockResolvedValue({
      error: NextResponse.json({ success: false, error: 'Accès administrateur requis' }, { status: 403 }),
    });
    adminClientMock.mockReturnValue({} as ReturnType<typeof createAdminSupabaseClient>);
  });

  afterAll(() => {
    if (originalCronSecret === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = originalCronSecret;
  });

  it('GET does not expose pending information or dispatch without admin authorization', async () => {
    const response = await getNotifications(makeRequest('/api/notifications/dispatch'));

    expect(response.status).toBe(403);
    expect(dispatchMock).not.toHaveBeenCalled();
    expect(adminClientMock).not.toHaveBeenCalled();
  });

  it('GET returns the pending count to an authenticated admin without dispatching', async () => {
    const terminalQuery = Object.assign(
      Promise.resolve({ count: 4, error: null }),
      { select: jest.fn(), eq: jest.fn() }
    );
    terminalQuery.select.mockReturnValue(terminalQuery);
    terminalQuery.eq.mockReturnValue(terminalQuery);
    requireAdminMock.mockResolvedValue({
      supabase: { from: jest.fn(() => terminalQuery) } as never,
    });

    const response = await getNotifications(makeRequest('/api/notifications/dispatch'));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ success: true, pendingCount: 4 });
    expect(dispatchMock).not.toHaveBeenCalled();
  });

  it('GET dispatches only when the cron bearer secret matches', async () => {
    process.env.CRON_SECRET = 'unit-test-secret';

    const response = await getNotifications(makeRequest('/api/notifications/dispatch', undefined, {
      authorization: 'Bearer unit-test-secret',
    }));

    expect(response.status).toBe(200);
    expect(dispatchMock).toHaveBeenCalledTimes(1);
    expect(requireAdminMock).not.toHaveBeenCalled();
  });

  it('POST dispatches for an active same-origin admin session', async () => {
    const profile: Record<string, jest.Mock> = {};
    profile.select = jest.fn(() => profile);
    profile.eq = jest.fn(() => profile);
    profile.single = jest.fn().mockResolvedValue({ data: { role: 'admin', is_active: true } });
    serverClientMock.mockResolvedValue({
      auth: { getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'admin-1' } }, error: null }) },
      from: jest.fn(() => profile),
    } as never);

    const response = await dispatchNotifications(makeRequest('/api/notifications/dispatch', {}));

    expect(response.status).toBe(200);
    expect(dispatchMock).toHaveBeenCalledTimes(1);
    expect(allowedOriginMock).toHaveBeenCalledWith(expect.anything());
  });

  it('POST rejects inactive admins and does not dispatch', async () => {
    const profile: Record<string, jest.Mock> = {};
    profile.select = jest.fn(() => profile);
    profile.eq = jest.fn(() => profile);
    profile.single = jest.fn().mockResolvedValue({ data: { role: 'admin', is_active: false } });
    serverClientMock.mockResolvedValue({
      auth: { getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'admin-1' } }, error: null }) },
      from: jest.fn(() => profile),
    } as never);

    const response = await dispatchNotifications(makeRequest('/api/notifications/dispatch', {}));

    expect(response.status).toBe(401);
    expect(dispatchMock).not.toHaveBeenCalled();
  });

  it('POST rejects an active non-admin user and does not dispatch', async () => {
    const profile: Record<string, jest.Mock> = {};
    profile.select = jest.fn(() => profile);
    profile.eq = jest.fn(() => profile);
    profile.single = jest.fn().mockResolvedValue({ data: { role: 'vendor', is_active: true } });
    serverClientMock.mockResolvedValue({
      auth: { getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'vendor-1' } }, error: null }) },
      from: jest.fn(() => profile),
    } as never);

    const response = await dispatchNotifications(makeRequest('/api/notifications/dispatch', {}));

    expect(response.status).toBe(401);
    expect(dispatchMock).not.toHaveBeenCalled();
  });

  it('POST rejects a foreign origin before checking session credentials', async () => {
    allowedOriginMock.mockReturnValue(false);

    const response = await dispatchNotifications(makeRequest('/api/notifications/dispatch', {}));

    expect(response.status).toBe(403);
    expect(serverClientMock).not.toHaveBeenCalled();
    expect(dispatchMock).not.toHaveBeenCalled();
  });

  it('POST accepts the configured cron bearer without a session lookup', async () => {
    process.env.CRON_SECRET = 'unit-test-secret';

    const response = await dispatchNotifications(makeRequest('/api/notifications/dispatch', {}, {
      authorization: 'Bearer unit-test-secret',
    }));

    expect(response.status).toBe(200);
    expect(dispatchMock).toHaveBeenCalledTimes(1);
    expect(serverClientMock).not.toHaveBeenCalled();
  });
});
