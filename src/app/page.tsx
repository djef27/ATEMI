import HeroSection from '@/components/home/HeroSection';
import CategoryGrid from '@/components/home/CategoryGrid';
import ProductGrid from '@/components/home/ProductGrid';
import StorySection from '@/components/home/StorySection';
import TrustEngagements from '@/components/home/TrustEngagements';
import PromoBanner from '@/components/home/PromoBanner';
import NewsletterSignup from '@/components/home/NewsletterSignup';
import HowItWorks from '@/components/home/HowItWorks';
import CtaSection from '@/components/home/CtaSection';
import { getNewProducts, getBestSellers, type HomeProduct } from '@/lib/supabase/queries';
import type { Metadata } from 'next';

export const revalidate = 60;

export const metadata: Metadata = {
  title: 'Atémi — Mode, Chaussures & Accessoires au Bénin',
  description:
    'Découvrez une sélection de produits de qualité chez les meilleurs vendeurs du Bénin. Payez en deux fois : acompte à la commande, solde à la livraison.',
};

async function safeGetProducts(
  fn: (limit: number) => Promise<HomeProduct[]>,
  limit: number
): Promise<HomeProduct[]> {
  try {
    return await fn(limit);
  } catch {
    return [];
  }
}

export default async function Home() {
  const [newProducts, bestSellers] = await Promise.all([
    safeGetProducts(getNewProducts, 8),
    safeGetProducts(getBestSellers, 8),
  ]);

  return (
    <main className="min-h-screen">
      <HeroSection />

      <CategoryGrid />

      <ProductGrid
        tagline="Juste arrivé"
        title="Nouveautés"
        products={newProducts}
        viewAllHref="/products"
      />

      <HowItWorks />

      <ProductGrid
        tagline="Les plus populaires"
        title="Meilleures ventes"
        products={bestSellers}
        viewAllHref="/products"
      />

      <StorySection />

      <PromoBanner />

      <TrustEngagements />

      <NewsletterSignup />

      <CtaSection />
    </main>
  );
}
