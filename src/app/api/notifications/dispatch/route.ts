import { NextRequest, NextResponse } from 'next/server';
import { createAdminSupabaseClient, createServerSupabaseClient } from '@/lib/supabase/server';
import { dispatchPendingNotifications } from '@/lib/notifications/dispatcher';
import { isAllowedOrigin, requireAdminAuth } from '@/lib/auth-helpers';

/**
 * POST /api/notifications/dispatch
 *
 * Processes pending WhatsApp notifications through the CENTRAL dispatcher
 * (claim atomique 'sending' + retry) — same mechanism used by the
 * post-payment automations. Two concurrent workers never send the same
 * notification twice (FOR UPDATE SKIP LOCKED at DB level).
 *
 * Auth: Requires admin session OR CRON_SECRET bearer token.
 *
 * Can be called:
 * - Manually by admin
 * - Via cron job (Vercel Cron, GitHub Actions, etc.)
 * - After payment confirmation (fire-and-forget)
 */
export async function POST(request: NextRequest) {
  try {
    // Auth: admin session or cron secret
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    let isAdmin = false;

    if (cronSecret && authHeader === `Bearer ${cronSecret}`) {
      isAdmin = true;
    } else {
      if (!isAllowedOrigin(request)) {
        return NextResponse.json({ success: false, error: 'Origine non autorisée' }, { status: 403 });
      }
      // Check admin session
      const authSupabase = await createServerSupabaseClient();
      const { data: { user } } = await authSupabase.auth.getUser();
      if (user) {
        const { data: profile } = await authSupabase
          .from('profiles')
          .select('role, is_active')
          .eq('id', user.id)
          .single();
        isAdmin = profile?.role === 'admin' && profile.is_active;
      }
    }

    if (!isAdmin) {
      return NextResponse.json(
        { success: false, error: 'Non autorisé' },
        { status: 401 }
      );
    }

    const supabase = createAdminSupabaseClient();
    const summary = await dispatchPendingNotifications({ supabase });

    return NextResponse.json({
      success: true,
      processed: summary.claimed,
      sent: summary.sent,
      retried: summary.retried,
      failed: summary.failed,
    });
  } catch (err) {
    console.error('[Dispatcher] Erreur interne:', err);
    return NextResponse.json(
      { success: false, error: 'Erreur interne du serveur' },
      { status: 500 }
    );
  }
}

// Vercel Cron dispatches with CRON_SECRET; authenticated admin GETs return the dashboard count.
export async function GET(request: NextRequest) {
  try {
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret && request.headers.get('authorization') === `Bearer ${cronSecret}`) {
      const supabase = createAdminSupabaseClient();
      const summary = await dispatchPendingNotifications({ supabase });
      return NextResponse.json({
        success: true,
        processed: summary.claimed,
        sent: summary.sent,
        retried: summary.retried,
        failed: summary.failed,
      });
    }

    if (!isAllowedOrigin(request)) {
      return NextResponse.json({ success: false, error: 'Origine non autorisée' }, { status: 403 });
    }

    const auth = await requireAdminAuth(request);
    if ('error' in auth) return auth.error;

    const supabase = auth.supabase;
    const { count, error } = await supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending')
      .eq('channel', 'whatsapp');

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, pendingCount: count || 0 });
  } catch {
    return NextResponse.json({ success: false, error: 'Erreur interne' }, { status: 500 });
  }
}
