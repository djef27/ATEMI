/**
 * Central WhatsApp dispatcher tests.
 *
 * Covers:
 *   1. Two concurrent workers -> a notification is claimed once, sent once.
 *   2. Temporary error -> retried (back to pending with next_retry_at).
 *   3. Definitive error -> failed, never retried.
 *   4. Max attempts reached -> failed.
 *   5. Already-sent notifications are never reclaimed / re-sent.
 *   6. Missing phone -> failed.
 */

import {
  dispatchPendingNotifications,
  processNotification,
  isDefinitiveError,
  computeNextRetryAt,
  NOTIFICATION_MAX_ATTEMPTS,
} from '@/lib/notifications/dispatcher';
import { sendWhatsAppMessage } from '@/lib/whatsapp';
import type { SupabaseClient } from '@supabase/supabase-js';

jest.mock('@/lib/supabase/server', () => ({
  createAdminSupabaseClient: jest.fn(),
  createServerSupabaseClient: jest.fn(),
}));

jest.mock('@/lib/whatsapp', () => ({
  sendWhatsAppMessage: jest.fn(),
}));

const mockSend = sendWhatsAppMessage as jest.MockedFunction<typeof sendWhatsAppMessage>;

function makeSupabaseMock(rpcReturn: Array<{ data: unknown[]; error: null }>) {
  const eq = jest.fn().mockResolvedValue({ error: null });
  const update = jest.fn((patch: Record<string, unknown>) => ({ eq }));
  const from = jest.fn(() => ({ update }));
  const rpc = jest
    .fn()
    .mockImplementationOnce(() => Promise.resolve(rpcReturn[0]))
    .mockImplementationOnce(() => Promise.resolve(rpcReturn[1] ?? rpcReturn[rpcReturn.length - 1]));

  const calls = { rpc, update, from, eq };
  return {
    supabase: { rpc, from } as unknown as SupabaseClient<any>,
    calls,
  };
}

const ROW = {
  id: '10000000-0000-0000-0000-000000000001',
  recipient_phone: '+22997000000',
  message: 'Nouvelle commande test',
  attempts: 0,
};

describe('NotificationDispatcher — two concurrent workers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('sends a claimed notification exactly once when two workers race', async () => {
    // Worker A claims the row (DB returns it), worker B claims nothing
    // (FOR UPDATE SKIP LOCKED excluded it).
    const a = makeSupabaseMock([{ data: [ROW], error: null }, { data: [], error: null }]);
    const b = makeSupabaseMock([{ data: [], error: null }, { data: [], error: null }]);
    mockSend.mockResolvedValue({ success: true, messageId: 'wamid_test' });

    const [summaryA, summaryB] = await Promise.all([
      dispatchPendingNotifications({ supabase: a.supabase }),
      dispatchPendingNotifications({ supabase: b.supabase }),
    ]);

    expect(summaryA.sent).toBe(1);
    expect(summaryA.claimed).toBe(1);
    expect(summaryB.sent).toBe(0);
    expect(summaryB.claimed).toBe(0);
    // La même notification n'a été envoyée qu'une seule fois.
    expect(mockSend).toHaveBeenCalledTimes(1);
    expect(mockSend).toHaveBeenCalledWith(ROW.recipient_phone, ROW.message);
  });

  it('does not re-send when there is nothing pending (sent not reclaimed)', async () => {
    const { supabase } = makeSupabaseMock([{ data: [], error: null }]);
    mockSend.mockResolvedValue({ success: true, messageId: 'wamid_test' });

    const summary = await dispatchPendingNotifications({ supabase });

    expect(summary.claimed).toBe(0);
    expect(mockSend).not.toHaveBeenCalled();
  });
});

describe('NotificationDispatcher — retry policy', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('retries a temporary failure: back to pending with attempts+1 and next_retry_at', async () => {
    const { supabase, calls } = makeSupabaseMock([{ data: [ROW], error: null }]);
    mockSend.mockResolvedValue({ success: false, error: 'Timeout: Meta API ne répond pas' });

    const summary = await dispatchPendingNotifications({ supabase });

    expect(summary.retried).toBe(1);
    expect(summary.sent).toBe(0);
    expect(summary.failed).toBe(0);

    // La notification retourne en 'pending' avec une prochaine tentative.
    const patch = calls.update.mock.calls[0][0] as Record<string, unknown>;
    expect(patch.status).toBe('pending');
    expect(patch.attempts).toBe(1);
    expect(typeof patch.next_retry_at).toBe('string');
    expect(new Date(patch.next_retry_at as string).getTime()).toBeGreaterThan(Date.now());
  });

  it('a retried notification can succeed on the next cycle', async () => {
    const { supabase } = makeSupabaseMock([{ data: [ROW], error: null }]);
    mockSend
      .mockResolvedValueOnce({ success: false, error: 'Timeout: Meta API ne répond pas' })
      .mockResolvedValueOnce({ success: true, messageId: 'wamid_ok' });

    // Premier cycle : retry. On simule ensuite que le claim rend une ligne
    // avec attempts=1 (état déjà persisté) et l'envoi réussit.
    const first = await processNotification(supabase, { ...ROW, attempts: 0 });
    expect(first).toBe('retried');

    const second = await processNotification(supabase, { ...ROW, attempts: 1 });
    expect(second).toBe('sent');
    expect(mockSend).toHaveBeenCalledTimes(2);
  });

  it('marks definitive errors as failed without scheduling a retry', async () => {
    const { supabase, calls } = makeSupabaseMock([{ data: [ROW], error: null }]);
    mockSend.mockResolvedValue({
      success: false,
      error: "Le numéro +22997000000 n'est pas inscrit sur WhatsApp Business",
    });

    const summary = await dispatchPendingNotifications({ supabase });

    expect(summary.failed).toBe(1);
    const patch = calls.update.mock.calls[0][0] as Record<string, unknown>;
    expect(patch.status).toBe('failed');
    expect(patch.next_retry_at).toBeNull();
    expect(patch.attempts).toBe(1);
  });

  it('stops retrying once max attempts is reached (even on temporary errors)', async () => {
    const { supabase, calls } = makeSupabaseMock([{ data: [{ ...ROW, attempts: NOTIFICATION_MAX_ATTEMPTS - 1 }], error: null }]);
    mockSend.mockResolvedValue({ success: false, error: 'Timeout: Meta API ne répond pas' });

    const summary = await dispatchPendingNotifications({ supabase });

    expect(summary.failed).toBe(1);
    expect(summary.retried).toBe(0);
    const patch = calls.update.mock.calls[0][0] as Record<string, unknown>;
    expect(patch.status).toBe('failed');
    expect(patch.attempts).toBe(NOTIFICATION_MAX_ATTEMPTS);
    expect(patch.next_retry_at).toBeNull();
  });

  it('flags a missing phone as failed', async () => {
    const { supabase } = makeSupabaseMock([{
      data: [{ ...ROW, recipient_phone: null }],
      error: null,
    }]);

    const summary = await dispatchPendingNotifications({ supabase });

    expect(summary.failed).toBe(1);
    expect(mockSend).not.toHaveBeenCalled();
  });
});

describe('NotificationDispatcher — helpers', () => {
  it('classifies errors as definitive vs temporary', () => {
    expect(isDefinitiveError("Le numéro n'est pas inscrit sur WhatsApp Business")).toBe(true);
    expect(isDefinitiveError('Token Meta invalide ou expiré')).toBe(true);
    expect(isDefinitiveError('Timeout: Meta API ne répond pas')).toBe(false);
    expect(isDefinitiveError('Erreur réseau: fetch failed')).toBe(false);
    expect(isDefinitiveError('Rate limit Meta atteint')).toBe(false);
    expect(isDefinitiveError(null)).toBe(false);
  });

  it('computes a valid retry timestamp in the future', () => {
    const now = new Date('2026-09-11T10:00:00Z');
    const next = computeNextRetryAt(1, now);
    expect(new Date(next).getTime()).toBe(now.getTime() + 60_000);
  });

  it('never transforms a sent notification back to pending', async () => {
    // La requête de claim ne cible QUE pending/sending : une notification
    // 'sent' n'est jamais récupérée. Le claim renvoyant [], rien n'est envoyé.
    const { supabase } = makeSupabaseMock([{ data: [], error: null }]);
    mockSend.mockResolvedValue({ success: true, messageId: 'wamid' });
    const summary = await dispatchPendingNotifications({ supabase });
    expect(summary.sent).toBe(0);
    expect(mockSend).not.toHaveBeenCalled();
  });
});