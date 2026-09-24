/**
 * Central WhatsApp notification dispatcher — SINGLE mechanism.
 *
 * Used by BOTH:
 *   - dispatchPaymentActions() (post-payment automations, fire-and-forget)
 *   - POST /api/notifications/dispatch (manual admin / cron)
 *
 * Concurrency guarantee:
 *   Notifications are claimed ATOMICALLY at the database level via the
 *   SQL function claim_pending_whatsapp_notifications (UPDATE ... FOR UPDATE
 *   SKIP LOCKED). Two workers can never reserve the same row, so a message
 *   is sent at most once per claim cycle.
 *
 * Retry policy:
 *   - attempts / next_retry_at persist on the row.
 *   - Temporary errors  -> back to 'pending' with next_retry_at (backoff).
 *   - Definitive errors -> 'failed' (never retried).
 *   - attempts >= NOTIFICATION_MAX_ATTEMPTS -> 'failed'.
 *   - A 'sent' notification is never reclaimed (claim only targets
 *     'pending' and stale 'sending').
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminSupabaseClient } from '@/lib/supabase/server';
import { sendWhatsAppMessage } from '@/lib/whatsapp';
import type { Database } from '@/types/database';

export const NOTIFICATION_MAX_ATTEMPTS = 3;
export const NOTIFICATION_RETRY_BASE_SECONDS = 60;
export const NOTIFICATION_CLAIM_LIMIT = 10;

export interface NotificationDispatchRow {
  id: string;
  recipient_phone: string | null;
  message: string;
  attempts?: number | null;
}

export interface NotificationDispatchSummary {
  claimed: number;
  sent: number;
  retried: number;
  failed: number;
}

export type NotificationOutcome = 'sent' | 'retried' | 'failed';

/**
 * Classify an error as definitive (never retry) vs temporary (retryable).
 */
export function isDefinitiveError(error: string | null | undefined): boolean {
  const msg = (error || '').toLowerCase();
  const definitiveMarkers = [
    "n'est pas inscrit sur whatsapp",
    "n'est pas inscrit",
    'numéro invalide',
    'numero invalide',
    'token meta invalide',
    'message trop long',
    'nombre de messages trop élevé',
    'http 401',
    'http 403',
  ];
  return definitiveMarkers.some((marker) => msg.includes(marker));
}

/**
 * Compute the next retry timestamp (linear backoff: 60s, 120s, 180s, ...).
 */
export function computeNextRetryAt(
  attempts: number,
  now: Date = new Date()
): string {
  const delaySeconds = NOTIFICATION_RETRY_BASE_SECONDS * Math.max(1, attempts);
  return new Date(now.getTime() + delaySeconds * 1000).toISOString();
}

/**
 * Atomically claim pending WhatsApp notifications.
 * Returns [] when nothing is available (or on DB error — logged).
 */
export async function claimPendingNotifications(
  supabase: SupabaseClient,
  limit: number = NOTIFICATION_CLAIM_LIMIT
): Promise<NotificationDispatchRow[]> {
  const { data, error } = await supabase.rpc('claim_pending_whatsapp_notifications', {
    p_limit: limit,
  });

  if (error) {
    console.error('[NotificationDispatcher] claim failed:', error.message);
    return [];
  }

  const rows = Array.isArray(data) ? data : [];
  return rows as unknown as NotificationDispatchRow[];
}

type NotificationUpdate = Partial<Database['public']['Tables']['notifications']['Update']>;

async function updateNotification(
  supabase: SupabaseClient,
  id: string,
  patch: NotificationUpdate
): Promise<boolean> {
  const { error } = await supabase
    .from('notifications')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) {
    console.error('[NotificationDispatcher] update failed for', id, ':', error.message);
    return false;
  }
  return true;
}

/**
 * Process a single claimed notification: send, then persist the outcome.
 */
export async function processNotification(
  supabase: SupabaseClient,
  row: NotificationDispatchRow
): Promise<NotificationOutcome> {
  if (!row.recipient_phone) {
    await updateNotification(supabase, row.id, {
      status: 'failed',
      error_message: 'Numéro de téléphone manquant',
      next_retry_at: null,
    });
    return 'failed';
  }

  const result = await sendWhatsAppMessage(row.recipient_phone, row.message);
  const attempts = (typeof row.attempts === 'number' ? row.attempts : 0) + 1;

  if (result.success) {
    await updateNotification(supabase, row.id, {
      status: 'sent',
      provider_message_id: result.messageId || null,
      sent_at: new Date().toISOString(),
      error_message: null,
      next_retry_at: null,
      attempts,
    });
    return 'sent';
  }

  const errorMessage = result.error || 'Erreur inconnue';

  if (isDefinitiveError(errorMessage) || attempts >= NOTIFICATION_MAX_ATTEMPTS) {
    await updateNotification(supabase, row.id, {
      status: 'failed',
      error_message: errorMessage,
      next_retry_at: null,
      attempts,
    });
    return 'failed';
  }

  await updateNotification(supabase, row.id, {
    status: 'pending',
    attempts,
    error_message: errorMessage,
    next_retry_at: computeNextRetryAt(attempts),
  });
  return 'retried';
}

/**
 * Claim + process up to `limit` notifications.
 * The single entry point used by the route and by dispatchPaymentActions.
 */
export async function dispatchPendingNotifications(options?: {
  limit?: number;
  supabase?: SupabaseClient;
}): Promise<NotificationDispatchSummary> {
  const supabase = options?.supabase ?? (createAdminSupabaseClient() as SupabaseClient);
  const rows = await claimPendingNotifications(supabase, options?.limit);

  const summary: NotificationDispatchSummary = {
    claimed: rows.length,
    sent: 0,
    retried: 0,
    failed: 0,
  };

  for (const row of rows) {
    const outcome = await processNotification(supabase, row);
    if (outcome === 'sent') summary.sent += 1;
    else if (outcome === 'retried') summary.retried += 1;
    else summary.failed += 1;
  }

  if (rows.length > 0) {
    console.log(
      `[NotificationDispatcher] Traité ${rows.length} notification(s): ` +
      `${summary.sent} envoyée(s), ${summary.retried} retry, ${summary.failed} échouée(s)`
    );
  }

  return summary;
}