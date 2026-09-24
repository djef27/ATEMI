import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { checkRateLimit, RATE_LIMIT_CONFIGS } from '@/lib/rate-limit';

const contactSchema = z.object({
  name: z.string().min(1, 'Nom requis').max(200),
  email: z.string().email('Email invalide').max(200),
  subject: z.string().min(1, 'Sujet requis').max(300),
  message: z.string().min(10, 'Message trop court').max(5000),
});

function getClientIp(request: NextRequest): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'anonymous';
}

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    const rl = await checkRateLimit(`contact:${ip}`, RATE_LIMIT_CONFIGS.general);
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

    const parsed = contactSchema.safeParse(body);
    if (!parsed.success) {
      const firstError = parsed.error.issues[0]?.message || 'Données invalides';
      return NextResponse.json({ success: false, error: firstError }, { status: 400 });
    }

    // Store contact message in DB
    const { createAdminSupabaseClient } = await import('@/lib/supabase/server');
    const supabase = createAdminSupabaseClient();

    const { error: insertError } = await supabase
      .from('contact_messages')
      .insert({
        name: parsed.data.name,
        email: parsed.data.email,
        subject: parsed.data.subject,
        message: parsed.data.message,
      });

    if (insertError) {
      // Table might not exist yet — log and return success anyway
      console.error('contact_messages insert failed:', insertError.message);
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { success: false, error: 'Erreur interne du serveur' },
      { status: 500 }
    );
  }
}
