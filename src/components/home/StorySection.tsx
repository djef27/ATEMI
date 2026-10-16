import Image from 'next/image';
import { ScrollReveal } from './ScrollReveal';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export default async function StorySection() {
  let vendorCount = 50;
  let productCount = 500;

  try {
    const supabase = await createServerSupabaseClient();
    const [vendorsResult, productsResult] = await Promise.all([
      supabase.from('vendors').select('id', { count: 'exact', head: true }).eq('is_active', true),
      supabase.from('products').select('id', { count: 'exact', head: true }).eq('status', 'active').is('deleted_at', null),
    ]);
    if (vendorsResult.count != null && vendorsResult.count > 0) vendorCount = vendorsResult.count;
    if (productsResult.count != null && productsResult.count > 0) productCount = productsResult.count;
  } catch {
    // fallback to defaults
  }

  return (
    <section className="relative py-16 sm:py-24 bg-[#FAFAF8] overflow-hidden">
      {/* Decorative background elements */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-primary-100/50 rounded-full blur-[100px] -translate-y-1/2 pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-80 h-80 bg-accent-100/30 rounded-full blur-[80px] translate-y-1/2 pointer-events-none" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 z-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-center">
          <ScrollReveal>
            <div>
              <p className="tagline text-primary-500 mb-3">Notre histoire</p>
              <h2 className="font-serif text-3xl sm:text-4xl font-bold text-[#1A1919] mb-6 leading-tight">
                Une marketplace africaine,
                <br />
                construite marché par marché
              </h2>
              <div className="space-y-4 text-gray-600 leading-relaxed">
                <p>
                  Atémi met en lumière les vendeurs, les créateurs et les communautés d&apos;Afrique.
                  Notre ambition est de faciliter la découverte et l&apos;achat de produits africains
                  grâce à une expérience en ligne simple et fiable.
                </p>
                <p>
                  Nous commençons au Bénin et ouvrirons les marchés progressivement. Les moyens de
                  paiement et les zones de livraison proposés sont ceux effectivement disponibles
                  pour le pays sélectionné.
                </p>
              </div>
              <div className="mt-8 flex items-center gap-6">
                <div className="text-center">
                  <p className="font-serif text-2xl font-bold text-[#1A1919]">{vendorCount}+</p>
                  <p className="text-xs text-gray-500">Vendeurs actifs</p>
                </div>
                <div className="w-px h-10 bg-primary-200" />
                <div className="text-center">
                  <p className="font-serif text-2xl font-bold text-[#1A1919]">{productCount}+</p>
                  <p className="text-xs text-gray-500">Produits</p>
                </div>
                <div className="w-px h-10 bg-primary-200" />
                <div className="text-center">
                  <p className="font-serif text-2xl font-bold text-[#1A1919]">100%</p>
                  <p className="text-xs text-gray-500">Vision panafricaine</p>
                </div>
              </div>
            </div>
          </ScrollReveal>

          <ScrollReveal delay={200}>
            <div className="relative aspect-[4/5] rounded-2xl overflow-hidden shadow-2xl shadow-primary-900/10">
              <Image
                src="https://images.unsplash.com/photo-1766107349536-c6de9ab38dcd?w=800&h=1000&fit=crop&q=80"
                alt="Femme élégante en tenue Atémi"
                fill
                className="object-cover"
                sizes="(max-width: 1024px) 100vw, 50vw"
              />
              {/* Overlay gradient for depth */}
              <div className="absolute inset-0 bg-gradient-to-t from-primary-900/20 via-transparent to-transparent" />
            </div>
          </ScrollReveal>
        </div>
      </div>
    </section>
  );
}
