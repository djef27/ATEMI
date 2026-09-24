import { NextRequest, NextResponse } from 'next/server';
import { createAdminSupabaseClient, createServerSupabaseClient } from '@/lib/supabase/server';
import { dispatchPendingNotifications } from '@/lib/notifications/dispatcher';
import { isAllowedOrigin } from '@/lib/auth-helpers';

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
      // Check admin session
      const authSupabase = createServerSupabaseClient();
      const { data: { user } } = await authSupabase.auth.getUser();
      if (user) {
        const { data: profile } = await authSupabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single();
        isAdmin = profile?.role === 'admin';
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

// GET returns pending count for dashboard display
export async function GET(request: NextRequest) {
  try {
    if (!isAllowedOrigin(request)) {
      return NextResponse.json({ success: false, error: 'Origine non autorisée' }, { status: 403 });
    }

    const supabase = createAdminSupabaseClient();
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
