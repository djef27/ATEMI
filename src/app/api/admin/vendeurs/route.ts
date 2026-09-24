import { NextRequest, NextResponse } from 'next/server';
import { withAdminAuth } from '@/lib/auth-helpers';
import { vendorCreateSchema } from '@/lib/validations';
import { escapeLike } from '@/lib/utils';

export const GET = withAdminAuth(async (request, { supabase }) => {
  const url = new URL(request.url);
  const status = url.searchParams.get('status');
  const search = url.searchParams.get('q');

  let query = supabase
    .from('vendors')
    .select('*')
    .order('created_at', { ascending: false });

  if (status && status !== 'all') {
    query = query.eq('status', status);
  }
  if (search) {
    query = query.ilike('name', `%${escapeLike(search)}%`);
  }

  const { data: vendors, error } = await query;
  if (error) {
    return NextResponse.json({ success: false, error: 'Erreur lors du chargement' }, { status: 500 });
  }

  return NextResponse.json({ success: true, data: vendors });
});

export const POST = withAdminAuth(async (request, { supabase }) => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: 'Body invalide' },
      { status: 400 }
    );
  }

  const parsed = vendorCreateSchema.safeParse(body);
  if (!parsed.success) {
    const firstError = parsed.error.issues[0]?.message || 'Données invalides';
    return NextResponse.json(
      { success: false, error: firstError },
      { status: 400 }
    );
  }

  const { data: vendor, error: insertError } = await supabase
    .from('vendors')
    .insert({
      name: parsed.data.name,
      phone: parsed.data.phone ?? null,
      whatsapp_number: parsed.data.whatsapp_number ?? null,
      email: parsed.data.email ?? null,
      address: parsed.data.address ?? null,
      city: parsed.data.city,
      country: parsed.data.country,
      status: parsed.data.status,
    })
    .select()
    .single();

  if (insertError) {
    return NextResponse.json(
      { success: false, error: 'Erreur lors de la création du vendeur' },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, data: vendor });
});
