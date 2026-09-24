import { NextRequest, NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabase/server';
import { verifyMetaSignature, verifyMetaChallenge } from '@/lib/whatsapp-webhook';

/**
 * POST /api/whatsapp/webhook
 *
 * Receives WhatsApp Business Cloud API events from Meta:
 *   - `messages` — inbound messages (inbound flows / user replies)
 *   - `statuses` — delivery receipts (sent/delivered/read/failed)
 *
 * Security:
 *   - GET verification uses WHATSAPP_VERIFY_TOKEN
 *   - POST payloads are authenticated via `X-Hub-Signature-256`
 *     (HMAC-SHA256 of the RAW body with WHATSAPP_APP_SECRET)
 *   - FAST return: Meta retries on non-200, so we acknowledge immediately
 *     and never block on outbound work.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const challenge = verifyMetaChallenge(searchParams);
  if (challenge === null) {
    return new NextResponse('Vérification Meta échouée', { status: 403 });
  }

  // Meta expects the raw challenge as the response body (text/plain)
  return new NextResponse(challenge, { headers: { 'Content-Type': 'text/plain' } });
}

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();

    // 1. Verify signature BEFORE parsing body
    const signature = request.headers.get('x-hub-signature-256');
    if (!verifyMetaSignature(signature, rawBody)) {
      return NextResponse.json({ error: 'Signature invalide' }, { status: 401 });
    }

    // 2. Parse (+ schema sanity)
    let payload: unknown;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: 'JSON invalide' }, { status: 400 });
    }

    const changes =
      (payload as { entry?: Array<{ changes?: Array<{ value?: unknown }> }> })
        ?.entry?.[0]?.changes?.[0]?.value;

    if (!changes) {
      // Acknowledge without processing (frequent for non-message webhooks)
      return NextResponse.json({ received: true });
    }

    const value = changes as {
      messages?: Array<{ id: string; from: string; text?: { body?: string }; type?: string }>;
      statuses?: Array<{
        id: string;
        status: string;
        timestamp: string;
        errors?: Array<{ code?: number; title?: string }>;
      }>;
      metadata?: { display_phone_number?: string; phone_number_id?: string };
    };

    const supabase = createAdminSupabaseClient();

    // ------------------------------------------------------------------
    // 3. Delivery statuses → update notifications rows
    //    Idempotent: only touch rows that are still 'sent' (not already
    //    terminal) and match by provider_message_id.
    // ------------------------------------------------------------------
    if (value.statuses?.length) {
      for (const status of value.statuses) {
        const isDelivered = status.status === 'delivered';
        const isFailed = status.status === 'failed';

        if (!isDelivered && !isFailed) continue;

        const update: {
          status: 'delivered' | 'failed';
          error_message?: string | null;
          updated_at: string;
        } = {
          status: isDelivered ? 'delivered' : 'failed',
          updated_at: new Date().toISOString(),
        };

        if (isFailed) {
          const err = status.errors?.[0];
          update.error_message = err ? `Meta: ${err.code || ''} ${err.title || ''}`.trim() : 'Meta: envoi échoué';
        }

        let q = supabase
          .from('notifications')
          .update(update)
          .eq('provider_message_id', status.id);

        // Never downgrade a 'delivered' row; only flip from 'sent'
        if (isFailed) {
          q = q.eq('status', 'sent');
        }

        const { error: updateError } = await q;
        if (updateError) {
          console.warn('[WhatsApp Webhook] Status update échoué:', status.id, updateError.message);
        }
      }
    }

    // ------------------------------------------------------------------
    // 4. Inbound messages → lightweight dedupe + log
    //    (No auto-reply for now; inbound flows can be added later.)
    // ------------------------------------------------------------------
    if (value.messages?.length) {
      const messages = value.messages.filter((m) => m.type === 'text');
      for (const msg of messages) {
        const { data: existing } = await supabase
          .from('notifications')
          .select('id, recipient_phone')
          .eq('provider_message_id', msg.id)
          .limit(1);

        if (existing?.length) continue; // already recorded (idempotent)

        const { data: ins } = await supabase
          .from('notifications')
          .insert({
            channel: 'whatsapp',
            notification_type: 'inbound_message',
            recipient_phone: msg.from || null,
            message: msg.text?.body?.slice(0, 4000) || '(message non-texte)',
            provider_message_id: msg.id,
            status: 'sent',
            sent_at: new Date().toISOString(),
          })
          .select('id')
          .single();

        if (!ins) {
          console.warn('[WhatsApp Webhook] Inbound message not stored (duplicate?)');
        }
      }
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    // Log server-side, but always ack to stop Meta retry storms.
    console.error('[WhatsApp Webhook] Erreur interne:', err);
    return NextResponse.json({ received: true, error: 'handled' });
  }
}

export async function PUT() {
  return NextResponse.json({ error: 'Méthode non autorisée' }, { status: 405 });
}

export async function DELETE() {
  return NextResponse.json({ error: 'Méthode non autorisée' }, { status: 405 });
}