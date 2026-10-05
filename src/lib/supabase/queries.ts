import { createServerSupabaseClient } from './server';

// ============================================
// Home page types
// ============================================

export interface HomeCategory {
  id: string;
  name: string;
  slug: string;
  image_url: string | null;
}

export interface HomeProduct {
  id: string;
  name: string;
  slug: string;
  selling_price: number;
  deposit_rate: number;
  deposit_amount: number;
  stock: number;
  vendor_name: string | null;
  vendor_city: string | null;
  image_url: string | null;
  category_slug: string | null;
  created_at: string;
}

// ============================================
// Shared helpers
// ============================================

async function fetchPrimaryImages(productIds: string[]): Promise<Map<string, string>> {
  const supabase = await createServerSupabaseClient();
  const images = new Map<string, string>();

  if (productIds.length === 0) return images;

  try {
    const { data: mediaRows } = await supabase
      .from('product_images')
      .select('product_id, image_url, is_primary, sort_order')
      .in('product_id', productIds);

    if (mediaRows) {
      for (const row of mediaRows) {
        if (row.is_primary && !images.has(row.product_id)) {
          images.set(row.product_id, row.image_url);
        }
      }
      for (const row of mediaRows) {
        if (!images.has(row.product_id)) {
          images.set(row.product_id, row.image_url);
        }
      }
    }
  } catch {
    // product_images query failed, continue without images
  }

  return images;
}

// ============================================
// Queries (no FK joins — fetch separately)
// ============================================

export async function getHomeCategories(): Promise<HomeCategory[]> {
  try {
    const supabase = await createServerSupabaseClient();

    const { data, error } = await supabase
      .from('categories')
      .select('id, name, slug, image_url')
      .eq('is_active', true)
      .order('name');

    if (error) {
      console.error('getHomeCategories error:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('getHomeCategories unavailable:', error instanceof Error ? error.message : error);
    return [];
  }
}

export async function getNewProducts(limit = 8): Promise<HomeProduct[]> {
  try {
    const supabase = await createServerSupabaseClient();

    const { data: products, error } = await supabase
      .from('products')
      .select('id, name, slug, selling_price, deposit_rate, deposit_amount, stock, created_at, vendor_id, category_id')
      .eq('status', 'active')
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error || !products || products.length === 0) {
      return [];
    }

    const productIds = products.map(p => p.id);

    // Fetch images + vendors in parallel
    const vendorIds = Array.from(new Set(products.map(p => p.vendor_id).filter(Boolean)));
    const [primaryImages, vendorData] = await Promise.all([
      fetchPrimaryImages(productIds),
      vendorIds.length > 0
        ? supabase.from('vendors').select('id, name, city').in('id', vendorIds)
        : Promise.resolve({ data: null }),
    ]);

    const vendorMap = new Map<string, { name: string; city: string }>();
    for (const v of vendorData.data || []) {
      vendorMap.set(v.id, { name: v.name, city: v.city });
    }

    return products.map(p => {
      const v = vendorMap.get(p.vendor_id);
      return {
        id: p.id,
        name: p.name,
        slug: p.slug,
        selling_price: p.selling_price,
        deposit_rate: p.deposit_rate,
        deposit_amount: p.deposit_amount,
        stock: p.stock,
        vendor_name: v?.name ?? null,
        vendor_city: v?.city ?? null,
        image_url: primaryImages.get(p.id) ?? null,
        category_slug: null,
        created_at: p.created_at,
      };
    });
  } catch (error) {
    console.error('getNewProducts unavailable:', error instanceof Error ? error.message : error);
    return [];
  }
}

export async function getBestSellers(limit = 8): Promise<HomeProduct[]> {
  try {
    const supabase = await createServerSupabaseClient();

    // Fetch order_items + products in parallel
    const [orderItemsResult, productsResult] = await Promise.all([
      supabase.from('order_items').select('product_id').limit(2000),
      supabase
        .from('products')
        .select('id, name, slug, selling_price, deposit_rate, deposit_amount, stock, created_at, vendor_id, category_id')
        .eq('status', 'active')
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(50),
    ]);

    // Count order_items per product for popularity ranking
    let counts = new Map<string, number>();
    for (const item of orderItemsResult.data || []) {
      counts.set(item.product_id, (counts.get(item.product_id) || 0) + 1);
    }

    const products = productsResult.data;

    if (productsResult.error || !products || products.length === 0) {
      return [];
    }

    // Sort by order_item count (desc), fallback to created_at
    const sorted = [...products].sort((a, b) => {
      const countA = counts.get(a.id) || 0;
      const countB = counts.get(b.id) || 0;
      if (countB !== countA) return countB - countA;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    const top = sorted.slice(0, limit);
    const productIds = top.map(p => p.id);

    // Fetch images + vendors in parallel
    const vendorIds = Array.from(new Set(top.map(p => p.vendor_id).filter(Boolean)));
    const [primaryImages, vendorData] = await Promise.all([
      fetchPrimaryImages(productIds),
      vendorIds.length > 0
        ? supabase.from('vendors').select('id, name, city').in('id', vendorIds)
        : Promise.resolve({ data: null }),
    ]);

    const vendorMap = new Map<string, { name: string; city: string }>();
    for (const v of vendorData.data || []) {
      vendorMap.set(v.id, { name: v.name, city: v.city });
    }

    return top.map(p => {
      const v = vendorMap.get(p.vendor_id);
      return {
        id: p.id,
        name: p.name,
        slug: p.slug,
        selling_price: p.selling_price,
        deposit_rate: p.deposit_rate,
        deposit_amount: p.deposit_amount,
        stock: p.stock,
        vendor_name: v?.name ?? null,
        vendor_city: v?.city ?? null,
        image_url: primaryImages.get(p.id) ?? null,
        category_slug: null,
        created_at: p.created_at,
      };
    });
  } catch (error) {
    console.error('getBestSellers unavailable:', error instanceof Error ? error.message : error);
    return [];
  }
}
