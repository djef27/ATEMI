import { NextRequest, NextResponse } from 'next/server';
import { withAdminAuth } from '@/lib/auth-helpers';
import { categoryCreateSchema } from '@/lib/validations';
import { slugify, escapeLike } from '@/lib/utils';

export const GET = withAdminAuth(async (request, { supabase }) => {
  const url = new URL(request.url);
  const status = url.searchParams.get('status');
  const search = url.searchParams.get('q');

  let query = supabase
    .from('categories')
    .select('*')
    .order('name');

  if (status && status !== 'all') {
    query = query.eq('is_active', status === 'active');
  }
  if (search) {
    query = query.ilike('name', `%${escapeLike(search)}%`);
  }

  const { data: categories, error } = await query;
  if (error) {
    return NextResponse.json({ success: false, error: 'Erreur lors du chargement' }, { status: 500 });
  }

  return NextResponse.json({ success: true, data: categories });
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

  const parsed = categoryCreateSchema.safeParse(body);
  if (!parsed.success) {
    const firstError = parsed.error.issues[0]?.message || 'Données invalides';
    return NextResponse.json(
      { success: false, error: firstError },
      { status: 400 }
    );
  }

  const slug = slugify(parsed.data.name);

  const { data: existing } = await supabase
    .from('categories')
    .select('id')
    .eq('slug', slug)
    .limit(1);

  if (existing && existing.length > 0) {
    return NextResponse.json(
      { success: false, error: 'Une catégorie avec ce nom existe déjà' },
      { status: 409 }
    );
  }

  const { data: category, error: insertError } = await supabase
    .from('categories')
    .insert({
      name: parsed.data.name,
      slug,
      description: parsed.data.description ?? null,
      image_url: parsed.data.image_url ?? null,
      is_active: parsed.data.is_active,
    })
    .select()
    .single();

  if (insertError) {
    return NextResponse.json(
      { success: false, error: 'Erreur lors de la création de la catégorie' },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, data: category });
});
