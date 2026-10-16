import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { checkRateLimit, RATE_LIMIT_CONFIGS } from '@/lib/rate-limit';
import { getClientIp } from '@/lib/request';

const newsletterSchema = z.object({
  email: z.string().email('Email invalide').max(200),
});

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    const rl = await checkRateLimit(`newsletter:${ip}`, RATE_LIMIT_CONFIGS.general);
    if (!rl.allowed) {
      return NextResponse.json(
        { success: false, error: `Trop de requêtes. Réessayez dans ${Math.ceil(rl.retryAfterMs / 1000)}s` },
        { status: 429 }
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ success: false, error: 'Body invalide' }, { status: 400 });
    }

    const parsed = newsletterSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues[0]?.message || 'Email invalide' },
        { status: 400 }
      );
    }

    const { createAdminSupabaseClient } = await import('@/lib/supabase/server');
    const supabase = createAdminSupabaseClient();

    // Upsert: if email exists, just return success (idempotent)
    const { error: insertError } = await supabase
      .from('newsletter_subscribers')
      .upsert(
        { email: parsed.data.email },
        { onConflict: 'email', ignoreDuplicates: true }
      );

    if (insertError) {
      console.error('newsletter_subscribers insert failed:', { code: insertError.code });
      return NextResponse.json(
        { success: false, error: 'Impossible d’enregistrer votre inscription. Réessayez plus tard.' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error(
      '[NEWSLETTER_SUBSCRIPTION_ERROR]',
      error instanceof Error ? error.name : 'Unknown error'
    );
    return NextResponse.json(
      { success: false, error: 'Erreur interne du serveur' },
      { status: 500 }
    );
  }
}
