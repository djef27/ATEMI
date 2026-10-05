import { createServerSupabaseClient } from '@/lib/supabase/server';
import ProductCard from '@/components/product-card';
import SearchBar from '@/components/search-bar';
import SortSelect from '@/components/sort-select';
import MobileFilterBar from '@/components/mobile-filter-bar';
import Breadcrumbs from '@/components/breadcrumbs';
import CatalogHero from '@/components/catalog-hero';
import { Suspense } from 'react';
import Link from 'next/link';
import type { Metadata } from 'next';
import type { PublicProduct } from '@/types';

export const metadata: Metadata = {
  title: 'Catalogue - Atémi',
  description: 'Découvrez notre sélection de produits',
};

interface ProductsPageProps {
  searchParams: Promise<{ q?: string; category?: string; sort?: string; page?: string }>;
}

export default async function ProductsPage({ searchParams }: ProductsPageProps) {
  const resolvedSearchParams = await searchParams;
  const searchQuery = resolvedSearchParams.q?.trim() || '';
  const categorySlug = resolvedSearchParams.category?.trim() || '';
  const sortParam = resolvedSearchParams.sort?.trim() || '';
  const requestedPage = Number.parseInt(resolvedSearchParams.page || '1', 10);
  const pageSize = 24;
  const maxPage = Math.floor(Number.MAX_SAFE_INTEGER / (pageSize + 1));
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 && requestedPage <= maxPage
    ? requestedPage
    : 1;
  const rangeStart = (page - 1) * pageSize;
  const rangeEnd = rangeStart + pageSize;

  let supabase: Awaited<ReturnType<typeof createServerSupabaseClient>> | null = null;

  try {
    supabase = await createServerSupabaseClient();
  } catch {
    return (
      <main className="min-h-screen bg-[#FAFAF8]">
        <CatalogHero />
        <div className="mx-auto max-w-4xl px-4 py-16 text-center text-gray-700">
          <h1 className="font-serif text-3xl font-bold text-[#1A1919] mb-3">Catalogue indisponible</h1>
          <p className="text-base text-gray-600">
            La configuration Supabase est inactive ou absente. Ajoutez l&apos;URL et les clés du projet actif pour réactiver le catalogue.
          </p>
        </div>
      </main>
    );
  }

  const categoriesPromise = (async () => {
    try {
      return await supabase
        .from('categories')
        .select('id, name, slug')
        .eq('is_active', true)
        .order('name');
    } catch {
      return { data: null, error: null };
    }
  })();

  let products: Array<{
    id: string;
    name: string;
    slug: string;
    selling_price: number;
    supplier_price: number | null;
    deposit_rate: number | null;
    deposit_amount: number;
    remaining_amount: number;
    stock: number;
    status: string;
    vendor_id: string;
    category_id: string;
  }> = [];
  let queryError = false;
  let categoryNotFound = false;
  let hasNextPage = false;

  try {
    let query = supabase
      .from('products')
      .select('id, name, slug, selling_price, supplier_price, deposit_rate, deposit_amount, remaining_amount, stock, status, vendor_id, category_id, created_at')
      .eq('status', 'active');

    if (searchQuery) {
      query = query.ilike('name', `%${searchQuery}%`);
    }

    if (categorySlug) {
      const { data: cat } = await supabase
        .from('categories')
        .select('id')
        .eq('slug', categorySlug)
        .eq('is_active', true)
        .single();

      if (cat) {
        query = query.eq('category_id', cat.id);
      } else {
        categoryNotFound = true;
      }
    }

    if (!categoryNotFound) {
      let ascending = false;
      let sortColumn = 'created_at';

      switch (sortParam) {
        case 'price_asc':
          sortColumn = 'selling_price';
          ascending = true;
          break;
        case 'price_desc':
          sortColumn = 'selling_price';
          ascending = false;
          break;
        case 'name':
          sortColumn = 'name';
          ascending = true;
          break;
        case 'best': {
          const { data: allProducts, error: fetchErr } = await query;
          if (!fetchErr && allProducts && allProducts.length > 0) {
            const productIds = allProducts.map(p => p.id);
            const { data: orderItems } = await supabase
              .from('order_items')
              .select('product_id')
              .in('product_id', productIds);
            if (orderItems && orderItems.length > 0) {
              const counts = new Map<string, number>();
              for (const item of orderItems) {
                counts.set(item.product_id, (counts.get(item.product_id) || 0) + 1);
              }
              products = [...allProducts].sort((a, b) => {
                const ca = counts.get(a.id) || 0;
                const cb = counts.get(b.id) || 0;
                if (cb !== ca) return cb - ca;
                return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
              });
            } else {
              products = allProducts;
            }
            hasNextPage = products.length > rangeEnd;
            products = products.slice(rangeStart, rangeEnd);
          }
          break;
        }
        case 'new':
        default:
          sortColumn = 'created_at';
          ascending = false;
          break;
      }

      if (sortParam !== 'best') {
        const { data, error } = await query
          .order(sortColumn, { ascending })
          .range(rangeStart, rangeEnd);

        if (error) {
          queryError = true;
        } else {
          const pageProducts = data || [];
          hasNextPage = pageProducts.length > pageSize;
          products = pageProducts.slice(0, pageSize);
        }
      }
    }
  } catch {
    queryError = true;
  }

  // Fetch categories alongside product data to avoid adding another round trip.
  let categories: Array<{ id: string; name: string; slug: string }> = [];
  const { data: cats } = await categoriesPromise;
  categories = cats || [];

  const productIds = products.map(p => p.id);

  const primaryImages = new Map<string, string>();
  const vendorIds = Array.from(new Set(products.map(p => p.vendor_id).filter(Boolean)));
  const vendorMap = new Map<string, string>();
  const categoryIds = Array.from(new Set(products.map(p => p.category_id).filter(Boolean)));
  const categoryMap = new Map<string, { id: string; name: string; slug: string }>();

  const loadMedia = async () => {
    if (productIds.length === 0) return null;
    try {
      const { data } = await supabase
        .from('product_images')
        .select('product_id, image_url, is_primary, sort_order')
        .in('product_id', productIds);
      return data;
    } catch {
      return null;
    }
  };
  const loadVendors = async () => {
    if (vendorIds.length === 0) return null;
    try {
      const { data } = await supabase.from('vendors').select('id, name').in('id', vendorIds);
      return data;
    } catch {
      return null;
    }
  };
  const loadCategories = async () => {
    if (categoryIds.length === 0) return null;
    try {
      const { data } = await supabase
        .from('categories')
        .select('id, name, slug')
        .in('id', categoryIds);
      return data;
    } catch {
      return null;
    }
  };
  const [mediaRows, vendorRows, categoryRows] = await Promise.all([
    loadMedia(),
    loadVendors(),
    loadCategories(),
  ]);

  if (mediaRows) {
    const grouped = new Map<string, Array<{ product_id: string; image_url: string; is_primary: boolean; sort_order: number }>>();
    for (const row of mediaRows) {
      const list = grouped.get(row.product_id) || [];
      list.push(row);
      grouped.set(row.product_id, list);
    }
    for (const [pid, rows] of Array.from(grouped.entries())) {
      const sorted = rows.sort((a, b) => {
        if (a.is_primary && !b.is_primary) return -1;
        if (!a.is_primary && b.is_primary) return 1;
        return a.sort_order - b.sort_order;
      });
      primaryImages.set(pid, sorted[0].image_url);
    }
  }

  for (const vendor of vendorRows || []) {
    vendorMap.set(vendor.id, vendor.name);
  }
  for (const category of categoryRows || []) {
    categoryMap.set(category.id, {
      id: category.id,
      name: category.name,
      slug: category.slug,
    });
  }

  const formattedProducts: PublicProduct[] = products.map((p) => ({
    id: String(p.id),
    vendor_id: String(p.vendor_id),
    category_id: p.category_id || '',
    name: String(p.name),
    slug: String(p.slug),
    description: null,
    selling_price: Number(p.selling_price),
    supplier_price: Number(p.supplier_price || 0),
    deposit_rate: Number(p.deposit_rate ?? 50),
    deposit_amount: Number(p.deposit_amount),
    remaining_amount: Number(p.remaining_amount),
    stock: Number(p.stock),
    status: 'active' as const,
    deleted_at: null,
    created_at: '',
    updated_at: '',
    category: categoryMap.get(p.category_id) || undefined,
    vendor_name: vendorMap.get(p.vendor_id) || undefined,
    image_url: primaryImages.get(String(p.id)) || null,
  }));

  const activeCategory = categories.find(c => c.slug === categorySlug);
  const pageHref = (targetPage: number) => {
    const params = new URLSearchParams();
    if (searchQuery) params.set('q', searchQuery);
    if (categorySlug) params.set('category', categorySlug);
    if (sortParam) params.set('sort', sortParam);
    if (targetPage > 1) params.set('page', String(targetPage));
    const queryString = params.toString();
    return queryString ? `/products?${queryString}` : '/products';
  };

  return (
    <main className="min-h-screen">
      <CatalogHero />

      <div id="products" className="mx-auto max-w-7xl scroll-mt-24 px-3 py-4 sm:px-6 sm:py-8">
        <Breadcrumbs
          items={[
            { label: 'Catalogue' },
            ...(activeCategory ? [{ label: activeCategory.name }] : []),
          ]}
        />
        <p className="text-sm text-gray-500 mb-3 sm:mb-4">
          {searchQuery
            ? `${formattedProducts.length} résultat${formattedProducts.length > 1 ? 's' : ''} pour « ${searchQuery} »`
            : formattedProducts.length > 0
              ? `${formattedProducts.length} produit${formattedProducts.length > 1 ? 's' : ''}`
              : ''}
        </p>

        <Suspense fallback={<div className="h-14 mb-6 bg-gray-100 rounded-xl animate-pulse" />}>
          <SearchBar />
        </Suspense>

        {/* Mobile: compact dropdowns */}
        {categories.length > 0 && (
          <div className="lg:hidden">
            <Suspense fallback={<div className="h-11 bg-gray-100 rounded-xl animate-pulse mb-4" />}>
              <MobileFilterBar categories={categories} />
            </Suspense>
          </div>
        )}

        {/* Desktop: category pills + sort */}
        <div className="hidden lg:flex flex-wrap items-center justify-between gap-4 mb-6">
          {categories.length > 0 && (
            <div className="flex flex-wrap gap-2">
              <Link
                href="/products"
                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                  !categorySlug
                    ? 'bg-primary-900 text-white'
                    : 'bg-white border border-primary-200 text-gray-600 hover:bg-primary-50'
                }`}
              >
                Tous
              </Link>
              {categories.map((cat) => (
                <Link
                  key={cat.id}
                  href={`/products?category=${cat.slug}${searchQuery ? `&q=${searchQuery}` : ''}${sortParam ? `&sort=${sortParam}` : ''}`}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                    categorySlug === cat.slug
                      ? 'bg-primary-900 text-white'
                      : 'bg-white border border-primary-200 text-gray-600 hover:bg-primary-50'
                  }`}
                >
                  {cat.name}
                </Link>
              ))}
            </div>
          )}

          <div className="flex items-center gap-2">
            <Suspense fallback={<div className="h-9 w-40 bg-gray-100 rounded-lg animate-pulse" />}>
              <SortSelect />
            </Suspense>
          </div>
        </div>

        {queryError && (
          <div className="p-4 rounded-lg bg-yellow-50 border border-yellow-200 text-yellow-800 mb-6">
            Impossible de charger les produits. Veuillez réessayer plus tard.
          </div>
        )}

        {!queryError && formattedProducts.length === 0 && (
          <div className="text-center py-20">
            <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-[#1A1919] font-serif mb-2">
              {searchQuery ? 'Aucun résultat' : 'Aucun produit disponible'}
            </h2>
            <p className="text-gray-600">
              {searchQuery
                ? 'Essayez avec d\'autres mots-clés.'
                : 'Les produits seront bientôt disponibles.'}
            </p>
          </div>
        )}

        {formattedProducts.length > 0 && (
          <div className="relative rounded-2xl overflow-hidden p-3 sm:p-6 lg:p-8">
            {/* Background image behind products */}
            <div className="absolute inset-0 bg-gradient-to-br from-primary-50 via-white to-accent-50 opacity-80" />
            <div className="absolute inset-0 texture-diagonal" />
            <div className="relative grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-6">
              {formattedProducts.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          </div>
        )}

        {(page > 1 || hasNextPage) && (
          <nav aria-label="Pagination du catalogue" className="mt-8 flex items-center justify-center gap-4">
            {page > 1 ? (
              <Link
                href={pageHref(page - 1)}
                className="rounded-lg border border-primary-200 bg-white px-4 py-2 text-sm font-medium text-primary-900 transition-colors hover:bg-primary-50"
              >
                Précédent
              </Link>
            ) : (
              <span />
            )}
            <span className="text-sm text-gray-600">Page {page}</span>
            {hasNextPage && (
              <Link
                href={pageHref(page + 1)}
                className="rounded-lg border border-primary-200 bg-white px-4 py-2 text-sm font-medium text-primary-900 transition-colors hover:bg-primary-50"
              >
                Suivant
              </Link>
            )}
          </nav>
        )}
      </div>
    </main>
  );
}
