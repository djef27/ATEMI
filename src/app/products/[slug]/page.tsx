import { createPublicServerSupabaseClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import AddToCartButton from '@/components/add-to-cart-button';
import ProductGallery from '@/components/product-gallery';
import Breadcrumbs from '@/components/breadcrumbs';
import Image from 'next/image';
import { Package } from 'lucide-react';
import type { Metadata } from 'next';
import { formatPrice } from '@/lib/utils';

export const revalidate = 60;
export const dynamicParams = true;

export async function generateStaticParams() {
  try {
    const supabase = await createPublicServerSupabaseClient();
    const { data } = await supabase
      .from('products')
      .select('slug')
      .eq('status', 'active')
      .is('deleted_at', null)
      .not('slug', 'is', null)
      .limit(500);
    return (data || [])
      .filter((p) => Boolean(p.slug))
      .map((p) => ({ slug: String(p.slug) }));
  } catch {
    return [];
  }
}

const CATEGORY_FALLBACKS: Record<string, string> = {
  'mode': 'https://images.unsplash.com/photo-1483985988355-763728e1935b?w=800&h=800&fit=crop&q=80',
  'chaussures': 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800&h=800&fit=crop&q=80',
  'perruques': 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=800&h=800&fit=crop&q=80',
  'beaute': 'https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=800&h=800&fit=crop&q=80',
  'accessoires': 'https://images.unsplash.com/photo-1611085583191-a3b181a88401?w=800&h=800&fit=crop&q=80',
  'sacs': 'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=800&h=800&fit=crop&q=80',
  'bijoux': 'https://images.unsplash.com/photo-1583292650898-7d22cd27ca6f?w=800&h=800&fit=crop&q=80',
  'maison': 'https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?w=800&h=800&fit=crop&q=80',
  'electronique': 'https://images.unsplash.com/photo-1468495244123-6c6c332eeece?w=800&h=800&fit=crop&q=80',
  'autres': 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=800&h=800&fit=crop&q=80',
};

const GENERIC_FALLBACK = 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=800&h=800&fit=crop&q=80';

interface ProductPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: ProductPageProps): Promise<Metadata> {
  try {
    const { slug } = await params;
    const supabase = await createPublicServerSupabaseClient();
    const { data: product } = await supabase
      .from('products')
      .select('name, description')
      .eq('slug', slug)
      .eq('status', 'active')
      .is('deleted_at', null)
      .single();

    if (!product) {
      return { title: 'Produit non trouvé' };
    }

    return {
      title: product.name,
      description: product.description?.substring(0, 160) || `${product.name} - Atémi`,
    };
  } catch {
    return { title: 'Produit' };
  }
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { slug } = await params;
  let product: Record<string, unknown> | null = null;
  let supabase: Awaited<ReturnType<typeof createPublicServerSupabaseClient>> | null = null;

  try {
    supabase = await createPublicServerSupabaseClient();

    const { data } = await supabase
      .from('products')
      .select('id, name, slug, description, selling_price, supplier_price, deposit_rate, deposit_amount, remaining_amount, stock, status, vendor_id, category_id, created_at, updated_at')
      .eq('slug', slug)
      .eq('status', 'active')
      .is('deleted_at', null)
      .single();

    product = data;
  } catch {
    notFound();
  }

  if (!product) {
    notFound();
  }

  if (!supabase) notFound();
  const db = supabase;
  const vendorId = String(product.vendor_id || '');
  const categoryId = String(product.category_id || '');

  const mediaPromise = (async () => {
    try {
      const { data } = await db
        .from('product_images')
        .select('image_url, alt_text, media_type, sort_order, is_primary')
        .eq('product_id', String(product.id))
        .order('sort_order');
      return data || [];
    } catch {
      return [];
    }
  })();

  const vendorPromise = (async () => {
    if (!vendorId) return null;
    try {
      const { data } = await db
        .from('vendors')
        .select('id, name, city')
        .eq('id', vendorId)
        .single();
      return data;
    } catch {
      return null;
    }
  })();

  const categoryPromise = (async () => {
    if (!categoryId) return null;
    try {
      const { data } = await db
        .from('categories')
        .select('id, name, slug')
        .eq('id', categoryId)
        .single();
      return data;
    } catch {
      return null;
    }
  })();

  const [mediaRows, vendor, category] = await Promise.all([
    mediaPromise,
    vendorPromise,
    categoryPromise,
  ]);

  const images = mediaRows
    .filter(m => m.media_type === 'image')
    .sort((a, b) => {
      if (a.is_primary && !b.is_primary) return -1;
      if (!a.is_primary && b.is_primary) return 1;
      return a.sort_order - b.sort_order;
    });

  const video = mediaRows.find(m => m.media_type === 'video');

  const productName = String(product.name || '');
  const productDescription = product.description ? String(product.description) : '';
  const productSellingPrice = Number(product.selling_price || 0);
  const productDepositRate = Number(product.deposit_rate || 0);
  const productDepositAmount = Number(product.deposit_amount || 0);
  const productRemainingAmount = Number(product.remaining_amount || 0);
  const productStock = Number(product.stock || 0);

  const categorySlug = category?.slug || '';
  const primaryImageUrl = images[0]?.image_url || CATEGORY_FALLBACKS[categorySlug] || GENERIC_FALLBACK;

  const productForCart = {
    product_id: String(product.id),
    name: productName,
    slug: String(product.slug || ''),
    image: primaryImageUrl,
    selling_price: productSellingPrice,
    supplier_price: Number(product.supplier_price || 0),
    deposit_rate: productDepositRate,
    deposit_amount: productDepositAmount,
    remaining_amount: productRemainingAmount,
    quantity: 1,
    stock: productStock,
    vendor_id: vendorId,
    vendor_name: vendor?.name || '',
  };

  return (
    <main className="min-h-screen bg-[#FAFAF8]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <Breadcrumbs
          items={[
            { label: 'Catalogue', href: '/products' },
            ...(category ? [{ label: category.name, href: `/products?category=${category.slug}` }] : []),
            { label: productName },
          ]}
        />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
          <div className="space-y-4">
          <div className="aspect-square bg-white rounded-2xl border border-primary-100 shadow-sm overflow-hidden relative">
            <Image
              src={primaryImageUrl}
              alt={images[0]?.alt_text || productName}
              fill
              sizes="(max-width: 1024px) 100vw, 50vw"
              className="object-cover"
              priority
            />
            </div>

            <ProductGallery images={images} productName={productName} />

            {video && (
              <div className="bg-white rounded-2xl border border-primary-100 shadow-sm overflow-hidden">
                <video
                  src={video.image_url}
                  controls
                  className="w-full"
                  preload="metadata"
                />
              </div>
            )}
          </div>

          <div className="flex flex-col">
            {vendor && (
              <p className="text-sm text-gray-500 mb-2">
                {vendor.name}{vendor.city ? ` — ${vendor.city}` : ''}
              </p>
            )}

            <h1 className="text-2xl sm:text-3xl font-bold text-[#1A1919] font-serif mb-4">
              {productName}
            </h1>

            <div className="mb-6">
              <div className="flex items-baseline gap-3">
                <span className="text-3xl font-bold text-primary-700">
                  {formatPrice(productSellingPrice)}
                </span>
              </div>
              <p className="mt-1 text-sm text-gray-500">
                Acompte ({productDepositRate}%) : {formatPrice(productDepositAmount)} — Solde : {formatPrice(productRemainingAmount)}
              </p>
            </div>

            <div className="mb-6">
              {productStock > 0 ? (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-50 text-green-700">
                  En stock ({productStock} disponible{productStock > 1 ? 's' : ''})
                </span>
              ) : (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-red-50 text-red-700">
                  Rupture de stock
                </span>
              )}
            </div>

            {productDescription && (
              <div className="prose prose-sm text-gray-600 mb-8 whitespace-pre-line">
                {productDescription}
              </div>
            )}

            <div className="mt-auto">
              {productStock > 0 ? (
                <AddToCartButton product={productForCart} />
              ) : (
                <button
                  disabled
                  className="w-full py-3 px-6 rounded-lg bg-gray-200 text-gray-500 font-medium cursor-not-allowed"
                >
                  Indisponible
                </button>
              )}
            </div>

            <div className="mt-6 p-4 bg-primary-50 rounded-lg text-sm text-gray-600">
              <p>Modalités de paiement affichées au checkout. Selon la commande, un acompte de {productDepositRate}% peut être demandé ; les options de règlement du solde et de réception sont précisées avant validation.</p>
            </div>
          </div>
        </div>

        {/* Similar products */}
        <SimilarProducts
          currentProductId={String(product.id)}
          categoryId={String(product.category_id)}
          currentSlug={String(product.slug)}
        />
      </div>
    </main>
  );
}

// ---------------------------------------------------------------------------
// Similar products (server component)
// ---------------------------------------------------------------------------

async function SimilarProducts({
  currentProductId,
  categoryId,
  currentSlug,
}: {
  currentProductId: string;
  categoryId: string;
  currentSlug: string;
}) {
  if (!categoryId) return null;

  let similarProducts: Array<{ id: string; name: string; slug: string; selling_price: number; deposit_rate: number; image_url: string | null }> = [];

  try {
    const supabase = await createPublicServerSupabaseClient();
    const { data: products } = await supabase
      .from('products')
      .select('id, name, slug, selling_price, deposit_rate')
      .eq('category_id', categoryId)
      .eq('status', 'active')
      .neq('id', currentProductId)
      .limit(4);

    if (products && products.length > 0) {
      const ids = products.map(p => p.id);
      const { data: images } = await supabase
        .from('product_images')
        .select('product_id, image_url')
        .eq('is_primary', true)
        .in('product_id', ids);

      const imageMap = new Map<string, string>();
      for (const img of images || []) {
        imageMap.set(img.product_id, img.image_url);
      }

      similarProducts = products.map(p => ({
        id: p.id,
        name: p.name,
        slug: p.slug,
        selling_price: p.selling_price,
        deposit_rate: p.deposit_rate,
        image_url: imageMap.get(p.id) || null,
      }));
    }
  } catch {
    // ignore
  }

  if (similarProducts.length === 0) return null;

  return (
    <section className="mt-12">
      <h2 className="font-serif text-xl font-bold text-[#1A1919] mb-6">Produits similaires</h2>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {similarProducts.map((p) => (
          <Link
            key={p.id}
            href={`/products/${p.slug}`}
            className="group block bg-white rounded-2xl border border-primary-100 overflow-hidden shadow-sm hover:shadow-md transition-shadow"
          >
            <div className="aspect-square bg-primary-50 overflow-hidden">
              {p.image_url ? (
                <Image
                  src={p.image_url}
                  alt={p.name}
                  width={400}
                  height={400}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-primary-300">
                  <Package className="w-8 h-8" />
                </div>
              )}
            </div>
            <div className="p-3">
              <h3 className="text-sm font-medium text-[#1A1919] line-clamp-2 mb-1">{p.name}</h3>
              <p className="text-sm font-bold text-primary-700">{formatPrice(p.selling_price)}</p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
