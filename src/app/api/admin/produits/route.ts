import { NextRequest, NextResponse } from 'next/server';
import { withAdminAuth } from '@/lib/auth-helpers';
import { productCreateSchema } from '@/lib/validations';
import { slugify, escapeLike } from '@/lib/utils';

export const GET = withAdminAuth(async (request, { supabase }) => {
  const url = new URL(request.url);
  const status = url.searchParams.get('status');
  const search = url.searchParams.get('q');
  const vendorId = url.searchParams.get('vendor_id');

  let query = supabase
    .from('products')
    .select('*, vendors(name)')
    .order('created_at', { ascending: false });

  if (status && status !== 'all') {
    query = query.eq('status', status);
  }
  if (search) {
    query = query.ilike('name', `%${escapeLike(search)}%`);
  }
  if (vendorId) {
    query = query.eq('vendor_id', vendorId);
  }

  const { data: products, error } = await query;
  if (error) {
    return NextResponse.json({ success: false, error: 'Erreur lors du chargement' }, { status: 500 });
  }

  return NextResponse.json({ success: true, data: products });
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

  const parsed = productCreateSchema.safeParse(body);
  if (!parsed.success) {
    const firstError = parsed.error.issues[0]?.message || 'Données invalides';
    return NextResponse.json(
      { success: false, error: firstError },
      { status: 400 }
    );
  }

  const { deposit_rate, selling_price, supplier_price } = parsed.data;
  const deposit_amount = Math.round(selling_price * deposit_rate / 100);
  const remaining_amount = selling_price - deposit_amount;

  const { data: vendor } = await supabase
    .from('vendors')
    .select('id')
    .eq('id', parsed.data.vendor_id)
    .eq('status', 'active')
    .limit(1);

  if (!vendor || vendor.length === 0) {
    return NextResponse.json(
      { success: false, error: 'Vendeur introuvable ou inactif' },
      { status: 400 }
    );
  }

  const { data: category } = await supabase
    .from('categories')
    .select('id')
    .eq('id', parsed.data.category_id)
    .eq('is_active', true)
    .limit(1);

  if (!category || category.length === 0) {
    return NextResponse.json(
      { success: false, error: 'Veuillez sélectionner une catégorie valide pour votre produit' },
      { status: 400 }
    );
  }

  const slug = slugify(parsed.data.name);

  const { data: existingSlug } = await supabase
    .from('products')
    .select('id')
    .eq('slug', slug)
    .limit(1);

  if (existingSlug && existingSlug.length > 0) {
    return NextResponse.json(
      { success: false, error: 'Un produit avec ce nom existe déjà' },
      { status: 409 }
    );
  }

  const { data: product, error: insertError } = await supabase
    .from('products')
    .insert({
      vendor_id: parsed.data.vendor_id,
      category_id: parsed.data.category_id,
      name: parsed.data.name,
      slug,
      description: parsed.data.description ?? null,
      supplier_price: parsed.data.supplier_price,
      selling_price,
      deposit_rate: parsed.data.deposit_rate ?? 50,
      deposit_amount,
      remaining_amount,
      stock: parsed.data.stock,
      status: parsed.data.status,
    })
    .select()
    .single();

  if (insertError) {
    return NextResponse.json(
      { success: false, error: 'Erreur lors de la création du produit' },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, data: product });
});
