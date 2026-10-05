import type { MetadataRoute } from 'next';
import { createServerSupabaseClient } from '@/lib/supabase/server';

const BASE_URL = 'https://atemi.bj';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  let supabase: Awaited<ReturnType<typeof createServerSupabaseClient>> | null = null;

  try {
    supabase = await createServerSupabaseClient();
  } catch {
    return [
      { url: BASE_URL, lastModified: new Date(), changeFrequency: 'weekly', priority: 1 },
      { url: `${BASE_URL}/products`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.9 },
      { url: `${BASE_URL}/a-propos`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
      { url: `${BASE_URL}/contact`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
      { url: `${BASE_URL}/devenir-vendeur`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
      { url: `${BASE_URL}/comment-ca-marche`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
      { url: `${BASE_URL}/cgv`, lastModified: new Date(), changeFrequency: 'yearly', priority: 0.2 },
      { url: `${BASE_URL}/politique-de-confidentialite`, lastModified: new Date(), changeFrequency: 'yearly', priority: 0.2 },
    ];
  }

  // Static pages
  const staticPages: MetadataRoute.Sitemap = [
    { url: BASE_URL, lastModified: new Date(), changeFrequency: 'weekly', priority: 1 },
    { url: `${BASE_URL}/products`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.9 },
    { url: `${BASE_URL}/a-propos`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
    { url: `${BASE_URL}/contact`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
    { url: `${BASE_URL}/devenir-vendeur`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
    { url: `${BASE_URL}/comment-ca-marche`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
    { url: `${BASE_URL}/cgv`, lastModified: new Date(), changeFrequency: 'yearly', priority: 0.2 },
    { url: `${BASE_URL}/politique-de-confidentialite`, lastModified: new Date(), changeFrequency: 'yearly', priority: 0.2 },
  ];

  // Dynamic product pages
  let productPages: MetadataRoute.Sitemap = [];
  try {
    const { data: products } = await supabase
      .from('products')
      .select('slug, updated_at')
      .eq('status', 'active')
      .not('slug', 'is', null)
      .limit(5000);

    productPages = (products || []).map((p) => ({
      url: `${BASE_URL}/products/${p.slug}`,
      lastModified: new Date(p.updated_at || Date.now()),
      changeFrequency: 'daily' as const,
      priority: 0.8,
    }));
  } catch {
    // ignore
  }

  // Dynamic category pages
  let categoryPages: MetadataRoute.Sitemap = [];
  try {
    const { data: categories } = await supabase
      .from('categories')
      .select('slug')
      .eq('is_active', true)
      .not('slug', 'is', null);

    categoryPages = (categories || []).map((c) => ({
      url: `${BASE_URL}/products?category=${c.slug}`,
      lastModified: new Date(),
      changeFrequency: 'daily' as const,
      priority: 0.7,
    }));
  } catch {
    // ignore
  }

  return [...staticPages, ...productPages, ...categoryPages];
}
